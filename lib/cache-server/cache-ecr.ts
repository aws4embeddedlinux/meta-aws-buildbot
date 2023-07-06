import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export interface CacheEcrProps extends cdk.StackProps {
    // optional name of the ecr registry.
    readonly repositoryName?: string;
}

export class CacheEcrStack extends cdk.Stack {
    public readonly repo: ecr.Repository;

    constructor(scope: cdk.App, id: string, props: CacheEcrProps) {
        super(scope, id, { ...props });
        this.repo = new ecr.Repository(this, props.repositoryName || 'cacheRegistry', {});
    }
}
