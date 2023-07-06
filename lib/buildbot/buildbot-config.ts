import * as cdk from 'aws-cdk-lib';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Bucket } from '../constructs';
import { Code, Repository } from 'aws-cdk-lib/aws-codecommit';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export interface BuildBotConfigProps extends cdk.StackProps {
    readonly bucketName?: string;
}

export class BuildBotConfig extends cdk.Stack {
    readonly bucket: IBucket;
    readonly configrepo: Repository;

    constructor(scope: cdk.App, id: string, props: BuildBotConfigProps) {
        super(scope, id, { ...props });

        const configBucket = new Bucket(this, 'ConfigBucket', {
            bucketName: props.bucketName,
        });

        const bucketDeploymentRole = new Role(this, 'BucketDeploymentRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
        });

        // TODO(glimsdal): Assert this instead of `if`.
        if (props.env) {
            const region = props.env.region;
            const account = props.env.account;

            // Give the asset upload lambda the ability to use the bucket.
            bucketDeploymentRole.addToPolicy(
                new PolicyStatement({
                    actions: ['kms:Decrypt'],
                    resources: [`arn:aws:kms:${region}:${account}:key/*`],
                }),
            );
        }

        new BucketDeployment(this, 'Deployment', {
            sources: [Source.asset('dist/admin-config')],
            destinationBucket: configBucket.bucket,
            destinationKeyPrefix: 'admin-config',
            role: bucketDeploymentRole,
            extract: true,
        });

        this.bucket = configBucket.bucket;

        const repository = new Repository(this, 'Repository', {
            repositoryName: 'buildbot-user-repo',
            code: Code.fromDirectory('configuration/user-repo', 'main'),
        });

        this.configrepo = repository;
    }
}
