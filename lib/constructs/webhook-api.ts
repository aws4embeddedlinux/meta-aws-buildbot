import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'path';
import * as fs from 'fs';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface WebhookAPIProps extends cdk.StackProps {
    /**
     * The name of the inner lambda function. Specifying the name can be useful
     * for discovering the function during testing.
     *
     * @default A Cloudformation auto-generated name.
     */
    readonly functionName?: string;
    /**
     * The VPC to put the lambda function's network interface in. This should
     * be the same VPC as the buildbot server.
     */
    readonly vpc: ec2.IVpc;
}

/**
 *
 */
export class WebhookAPI extends Construct {
    /**
     * The inner lambda function.
     */
    readonly function: lambda.IFunction;
    /**
     * A security group for the lambda function's network interface.
     */
    readonly securitygroup: ec2.ISecurityGroup;

    constructor(scope: Construct, id: string, props: WebhookAPIProps) {
        super(scope, id);

        this.securitygroup = new ec2.SecurityGroup(this, 'WebhookSecurityGroup', {
            vpc: props.vpc,
            description: 'Security Group for Webhook Intercepting Lambda.',
        });

        // Function to check if the event initiator is authorized.
        this.function = new lambda.Function(this, 'WebhookFunction', {
            functionName: props.functionName,
            code: lambda.Code.fromInline(
                fs.readFileSync(path.join(__dirname, '../../../lib/buildbot/lambda-source', 'index.py'), {
                    encoding: 'utf-8',
                }),
            ),
            handler: 'index.lambda_handler',
            timeout: Duration.minutes(1),
            runtime: lambda.Runtime.PYTHON_3_8,
            memorySize: 128,
            vpc: props.vpc,
            description: 'this will receive json payload by this webhook to trigger buildbot builds',
            securityGroups: [this.securitygroup],
        });

        this.function.addToRolePolicy(
            // TODO(glimsdal): Explicitly set resources here.
            new iam.PolicyStatement({
                actions: ['secretsmanager:GetSecretValue'],
                resources: ['*'],
            }),
        );

        // This Policy should block any non-github IP from reaching our webhook endpoint.
        const apiPolicy = iam.PolicyDocument.fromJson({
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Principal: '*',
                    Action: 'execute-api:Invoke',
                    Resource: ['execute-api:/*'],
                },
                {
                    Effect: 'Deny',
                    Principal: '*',
                    Action: 'execute-api:Invoke',
                    Resource: ['execute-api:/*'],
                    Condition: {
                        NotIpAddress: {
                            'aws:SourceIp': [
                                // This can be found at https://api.github.com/meta under 'hooks'.
                                '192.30.252.0/22',
                                '185.199.108.0/22',
                                '140.82.112.0/20',
                                '143.55.64.0/20',
                            ],
                        },
                    },
                },
            ],
        });

        const apigwLogs = new logs.LogGroup(this, 'loggroup', {
            retention: logs.RetentionDays.TEN_YEARS,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        new apigw.LambdaRestApi(this, 'restapi', {
            handler: this.function,
            policy: apiPolicy,
            deployOptions: {
                accessLogDestination: new apigw.LogGroupLogDestination(apigwLogs),
                accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
            },
        });
    }
}
