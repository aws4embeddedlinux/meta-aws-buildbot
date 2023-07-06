import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';

export interface CacheRepoProps extends cdk.StackProps {
    // optional name of the ecr registry.
    readonly repositoryName?: string;
}

export class CacheRepoStack extends cdk.Stack {
    public readonly repo: codecommit.IRepository;

    constructor(scope: cdk.App, id: string, props: CacheRepoProps) {
        super(scope, id, { ...props });

        // Add a codecommit repo to be a read replica of our internal cache repo.
        this.repo = new codecommit.Repository(this, 'CacheRepo', {
            repositoryName: props.repositoryName || 'CacheScripts',
            description: 'Scripts to build cache docker container.',
        });
    }
}
