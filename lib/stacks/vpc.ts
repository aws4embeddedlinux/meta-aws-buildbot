import { App, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

export type VpcProps = StackProps;

/**
 * A Vpc Stack with Flowlogs and endpoints enabled.
 */
export class Vpc extends Stack {
    public readonly vpc: ec2.Vpc;

    constructor(scope: App, id: string, props: VpcProps) {
        super(scope, id, { ...props });

        this.vpc = new ec2.Vpc(this, 'Vpc', {
            ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
            enableDnsHostnames: true,
            enableDnsSupport: true,
            defaultInstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
        });

        // TODO: Add Endpoints. Something was leaking from private Subnets.

        new ec2.FlowLog(this, 'VPCFlowLogs', {
            resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
            destination: ec2.FlowLogDestination.toCloudWatchLogs(
                new LogGroup(this, 'LogGroup', {
                    retention: RetentionDays.ONE_YEAR,
                }),
            ),
        });
    }
}
