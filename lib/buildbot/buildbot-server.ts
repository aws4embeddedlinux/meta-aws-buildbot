import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { ISecurityGroup, IVpc, Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { IAccessPoint, IFileSystem } from 'aws-cdk-lib/aws-efs';
import { FileSystem } from 'aws-cdk-lib/aws-efs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ListenerAction,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
    CfnInstanceProfile,
    ManagedPolicy,
    PolicyStatement,
    Effect,
    Role,
    ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { IPrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery';
import { Duration } from 'aws-cdk-lib';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';

import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { WebhookAPI } from '../constructs';

export interface DNS {
    readonly zone: route53.IHostedZone;
    readonly cert: acm.ICertificate;
}

export interface OidcAction {
    readonly issuer: string;
    readonly tokenEndpoint: string;
    readonly userInfoEndpoint: string;
    readonly authorizationEndpoint: string;
    readonly clientId: string;
    readonly clientSecret: cdk.SecretValue;
}

export interface BuildBotServerProps extends cdk.StackProps {
    readonly serviceName: string;
    readonly imageRepository: IRepository;
    readonly vpc: IVpc;
    readonly cluster: ecs.ICluster;
    readonly keypair: string;
    readonly filesystem: IFileSystem;
    readonly accesspoint: IAccessPoint;
    readonly namespace: IPrivateDnsNamespace;
    readonly dns?: DNS;
    readonly useWebhookAPI?: boolean;
    readonly oidcAction?: OidcAction;
}

export class BuildBotServer extends cdk.Stack {
    public readonly service: ecs.IBaseService;
    public readonly workerSecurityGroup: ISecurityGroup;
    // TODO: Rename to reflect DNS and cert
    public readonly loadBalancerDNS: string;
    public readonly buildBotServerPrivateDNS: string;
    public readonly workerVpcSubnetID: string;
    public readonly sstateFS: FileSystem;

    private securityGroups: ISecurityGroup[];

    constructor(scope: cdk.App, id: string, props: BuildBotServerProps) {
        super(scope, id, { ...props });

        // Temporary SG to allow only Corp access to our insecure service. Later we will use OIDC.
        const buildbotSg = new SecurityGroup(this, 'BuildBotCorpPrefix', {
            vpc: props.vpc,
            description: 'BuildBot Web Access From Corp.',
        });

        if (props.dns) {
            buildbotSg.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
        } else {
            buildbotSg.addIngressRule(Peer.prefixList('pl-f8a64391'), Port.tcp(80));
        }

        // Set up a SG for worker nodes to use.
        this.workerSecurityGroup = new SecurityGroup(this, 'BuildBotWorkerSg', {
            vpc: props.vpc,
            description: 'SG for worker nodes to use.',
        });
        this.workerSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.allTraffic(), 'Allow All Outbound');
        this.workerSecurityGroup.addIngressRule(
            Peer.ipv4(props.vpc.vpcCidrBlock),
            Port.allTcp(),
            'Allow All TCP inside the VPC',
        );

        this.securityGroups = [this.workerSecurityGroup];

        if (props.useWebhookAPI) {
            this.securityGroups.push(this.addWebhookAPI(props.vpc));
        }

        // Set up the ECS Server.
        const buildBotServerTask = new ecs.TaskDefinition(this, 'BuildBotServerTask', {
            compatibility: ecs.Compatibility.FARGATE,
            cpu: '1024',
            memoryMiB: '2048',
            volumes: [
                {
                    name: 'DBMount',
                    efsVolumeConfiguration: {
                        fileSystemId: props.filesystem.fileSystemId,
                        transitEncryption: 'ENABLED',
                        authorizationConfig: {
                            accessPointId: props.accesspoint.accessPointId,
                            iam: 'ENABLED',
                        },
                    },
                },
            ],
        });
        const serverContainer = buildBotServerTask.addContainer('ServerContainer', {
            image: ecs.ContainerImage.fromRegistry(props.imageRepository.repositoryUri),
            containerName: 'buildbot-server',
            portMappings: [
                { containerPort: 8010, protocol: ecs.Protocol.TCP },
                { containerPort: 9989, protocol: ecs.Protocol.TCP },
            ],
            logging: new ecs.AwsLogDriver({ streamPrefix: 'buildbot' }),
        });
        serverContainer.addMountPoints({
            containerPath: '/mount/data',
            sourceVolume: 'DBMount',
            readOnly: false,
        });

        const buildBotService = new ecs.FargateService(this, 'BuildBotService', {
            desiredCount: 1,
            minHealthyPercent: 0,
            maxHealthyPercent: 100,
            taskDefinition: buildBotServerTask,
            cluster: props.cluster,
            serviceName: props.serviceName,
            securityGroups: this.securityGroups,
            enableExecuteCommand: true,
            cloudMapOptions: {
                cloudMapNamespace: props.namespace,
                name: 'buildbot',
            },
            healthCheckGracePeriod: Duration.seconds(150),
        });

        // TODO: Find equivalent for:
        //    Peer.ipv4(props.vpc.vpcCidrBlock),
        buildBotService.connections.allowFromAnyIpv4(Port.tcp(9989));
        buildBotService.connections.allowTo(props.filesystem, Port.tcp(2049));

        // Create Internet Facing Load Balancer.
        const webLb = new ApplicationLoadBalancer(this, 'WebLB', {
            vpc: props.vpc,
            internetFacing: true,
            securityGroup: buildbotSg,
        });

        const loadBalancerAccessLogs = new Bucket(this, 'LoadBalancerLogs', {});
        webLb.logAccessLogs(loadBalancerAccessLogs);

        let webListener: ApplicationListener;
        if (props.dns) {
            webListener = webLb.addListener('Listener', {
                protocol: ApplicationProtocol.HTTPS,
                certificates: [props.dns.cert],
                open: true,
            });
        } else {
            webListener = webLb.addListener('Listener', {
                protocol: ApplicationProtocol.HTTP,
                open: true,
            });
        }

        const webTargetGroup = webListener.addTargets('WebTarget', {
            port: 8010,
            targets: [buildBotService],
            protocol: ApplicationProtocol.HTTP,
        });

        webTargetGroup.configureHealthCheck({
            path: '/api/v2',
            interval: Duration.seconds(150),
        });

        // Allow our service to create and manage EC2 Workers.
        buildBotService.taskDefinition.taskRole.addManagedPolicy(
            ManagedPolicy.fromManagedPolicyArn(
                this,
                'BuildBotServerPolicy',
                'arn:aws:iam::aws:policy/AmazonEC2FullAccess',
            ),
        );

        if (props.dns) {
            new route53.ARecord(this, 'ApigwARecord', {
                target: route53.RecordTarget.fromAlias(new LoadBalancerTarget(webLb)),
                zone: props.dns.zone,
            });

            if (props.oidcAction) {
                webListener.addAction('SSO', {
                    action: ListenerAction.authenticateOidc({
                        ...props.oidcAction,
                        next: ListenerAction.forward([webTargetGroup]),
                    }),
                });
            }
        }

        props.imageRepository.grantPull(buildBotService.taskDefinition.obtainExecutionRole());
        this.service = buildBotService;

        // This allows for 'Session Manager' based connections to the worker instances for debug.
        const workerRole = new Role(this, 'EC2WorkerRole', {
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
        });

        // Needed to attach the appropriate IAM Role to the Instance Profile from the buildbot server.
        buildBotServerTask.addToTaskRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'iam:PassRole',
                    'codecommit:BatchGet*',
                    'codecommit:Describe*',
                    'codecommit:Get*',
                    'codecommit:GitPull',
                    'codecommit:List*',
                ],
                // TODO resources: [workerRole.roleArn],
                resources: ['*'],
            }),
        );

        // This Instance Profile will carry the Worker Role to the actual worker instance.
        const instanceProfileName = 'buildbot-worker-profile';
        new CfnInstanceProfile(this, 'EC2WorkerProfile', {
            roles: [workerRole.roleName],
            instanceProfileName: instanceProfileName,
        });

        new CfnOutput(this, 'WorkerInstanceProfile', {
            value: instanceProfileName,
        });

        if (props.dns) {
            this.loadBalancerDNS = 'https://' + props.dns.zone.zoneName;
        } else {
            this.loadBalancerDNS = 'http://' + webLb.loadBalancerDnsName;
        }
        // loadBalancerDNS.toLowerCase();  does not work!? -> gives that??? http://${token[token.1744]}

        new CfnOutput(this, 'LoadBalancerDNS', { value: this.loadBalancerDNS });
        new CfnOutput(this, 'WorkerSecurityGroup', {
            value: this.workerSecurityGroup.securityGroupId,
        });

        this.workerVpcSubnetID = props.vpc.privateSubnets[0].subnetId;

        // sstate-volume
        const fileSystem = new FileSystem(this, 'Efs', {
            vpc: props.vpc,
            securityGroup: this.workerSecurityGroup,
            // performanceMode: PerformanceMode.GENERAL_PURPOSE,
            // vpcSubnets: {
            // subnetType: SubnetType.PRIVATE_WITH_EGRESS,
            // onePerAz: true,
            //    availabilityZones: [props.vpc.privateSubnets[0].availabilityZone],
            // },
        });

        buildBotServerTask.addToTaskRolePolicy(
            new PolicyStatement({
                actions: [
                    'elasticfilesystem:ClientRootAccess',
                    'elasticfilesystem:ClientWrite',
                    'elasticfilesystem:ClientMount',
                    'elasticfilesystem:DescribeMountTargets',
                ],
                resources: [
                    `arn:aws:elasticfilesystem:${this.region}:${this.account}:file-system/${fileSystem.fileSystemId}`,
                    props.filesystem.fileSystemArn,
                ],
            }),
        );

        buildBotServerTask.addToTaskRolePolicy(
            new PolicyStatement({
                actions: ['ec2:DescribeAvailabilityZones'],
                resources: ['*'],
            }),
        );

        this.sstateFS = fileSystem;
    }

    private addWebhookAPI(vpc: IVpc): ISecurityGroup {
        const webhookApi = new WebhookAPI(this, 'WebhookAPI', {
            vpc,
        });

        return webhookApi.securitygroup;
    }
}
