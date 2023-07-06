import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';

export interface BuildBotFilesystemProps extends cdk.StackProps {
    readonly vpc: ec2.IVpc;
}

export class BuildBotFilesystem extends cdk.Stack {
    readonly filesystem: efs.IFileSystem;
    readonly accesspoint: efs.IAccessPoint;

    constructor(scope: cdk.App, id: string, props: BuildBotFilesystemProps) {
        super(scope, id, { ...props });

        const filesystem = new efs.FileSystem(this, 'FileSystem', {
            vpc: props.vpc,
        });

        this.accesspoint = filesystem.addAccessPoint('AccessPoint', {
            path: '/buildbot-data',
            posixUser: {
                uid: '1000',
                gid: '1000',
            },
            createAcl: {
                ownerGid: '1000',
                ownerUid: '1000',
                permissions: '755',
            },
        });

        this.filesystem = filesystem;
    }
}
