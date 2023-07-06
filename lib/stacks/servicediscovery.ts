import { App, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';

export interface ServiceDomainProps extends StackProps {
    readonly vpc: ec2.IVpc;
}

/**
 * A Vpc Stack with Flowlogs and endpoints enabled.
 */
export class ServiceDomain extends Stack {
    public readonly namespace: servicediscovery.IPrivateDnsNamespace;

    constructor(scope: App, id: string, props: ServiceDomainProps) {
        super(scope, id, { ...props });
        this.namespace = new servicediscovery.PrivateDnsNamespace(this, 'ServiceNamespace', {
            vpc: props.vpc,
            description: 'DNS Namespace for internal VPC discovery.',
            name: 'service',
        });
    }
}
