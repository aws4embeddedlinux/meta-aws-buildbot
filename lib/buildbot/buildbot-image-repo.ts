import * as cdk from 'aws-cdk-lib';
import { IRepository, Repository } from 'aws-cdk-lib/aws-ecr';

export type BuildBotImageRepoProps = cdk.StackProps;

export class BuildBotImageRepo extends cdk.Stack {
    readonly repo: IRepository;

    constructor(scope: cdk.App, id: string, props: BuildBotImageRepoProps) {
        super(scope, id, { ...props });

        this.repo = new Repository(this, 'BuildBotServerECR', {});
    }
}
