import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { INamespace } from 'aws-cdk-lib/aws-servicediscovery';
import { AwsLogDriver } from 'aws-cdk-lib/aws-ecs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

export interface CacheEcsProps extends cdk.StackProps {
    // optional name of the fargate service.
    readonly serviceName?: string;

    readonly repository: ecr.IRepository;

    readonly vpc: ec2.Vpc;
    readonly cluster: ecs.ICluster;
    readonly namespace: INamespace;
}

export class CacheEcsStack extends cdk.Stack {
    public readonly service: ecs.IBaseService;

    constructor(scope: cdk.App, id: string, props: CacheEcsProps) {
        super(scope, id, { ...props });

        const cacheLogGroup = new LogGroup(this, 'CACHELogGroup', {
            logGroupName: '/ecs/cache',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_YEAR,
        });

        const cacheTaskDefinition = new ecs.FargateTaskDefinition(this, 'CACHETask', {
            cpu: 2048,
            memoryLimitMiB: 16384,
            ephemeralStorageGiB: 200,
        });

        cacheTaskDefinition.addContainer('AppContainer', {
            containerName: 'cache-server',
            image: ecs.ContainerImage.fromRegistry(props.repository.repositoryUri),
            logging: new AwsLogDriver({
                logGroup: cacheLogGroup,
                streamPrefix: 'CACHE-Cache',
            }),
            portMappings: [{ containerPort: 80 }, { containerPort: 873 }, { containerPort: 8687 }],
        });

        const patterns = new ecs_patterns.NetworkMultipleTargetGroupsFargateService(this, 'CACHEService', {
            cluster: props.cluster,
            taskDefinition: cacheTaskDefinition,
            loadBalancers: [
                {
                    name: 'cache-loadbalancer',
                    listeners: [
                        { name: 'cache-listener', port: 80 },
                        { name: 'rsync-listener', port: 873 },
                        { name: 'hashequiv-listener', port: 8687 },
                    ],
                    publicLoadBalancer: false,
                },
            ],
            targetGroups: [
                {
                    containerPort: 80,
                    listener: 'cache-listener',
                },
                {
                    containerPort: 873,
                    listener: 'rsync-listener',
                },
                {
                    containerPort: 8687,
                    listener: 'hashequiv-listener',
                },
            ],
            serviceName: props.serviceName ?? 'cache',
            memoryLimitMiB: 16384, // Default is 512
            cpu: 2048, // Default is 256
            cloudMapOptions: {
                cloudMapNamespace: props.namespace,
                name: 'cache',
            },
        });

        const ports = new Map<string, number>([
            ['HTTP', 80],
            ['RSYNC', 873],
            ['HASHEQUIV', 8687],
        ]);

        for (const [_, port] of ports) {
            const p = new ec2.Port({
                protocol: ec2.Protocol.TCP,
                stringRepresentation: port.toString(),
                fromPort: port,
                toPort: port,
            });
            patterns.service.connections.allowFromAnyIpv4(p);
        }

        // service.registerLoadBalancer('loadbalancer', patterns.loadBalancer);

        props.repository.grantPull(patterns.taskDefinition.obtainExecutionRole());

        this.service = patterns.service;
    }
}
