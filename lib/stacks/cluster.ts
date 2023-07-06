import { App, Stack, StackProps } from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface ClusterProps extends StackProps {
    readonly vpc: ec2.IVpc;
}

export class Cluster extends Stack {
    public readonly cluster: ecs.ICluster;

    constructor(scope: App, id: string, props: ClusterProps) {
        super(scope, id, props);

        this.cluster = new ecs.Cluster(this, 'Cluster', {
            vpc: props.vpc,
            containerInsights: true,
        });
    }
}
