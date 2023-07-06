import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { BuildSpec, ComputeType, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';

export interface CachePipelineProps extends cdk.StackProps {
    //
    readonly cacheRepo: string;

    readonly repository: ecr.IRepository;

    readonly cacheRepoBranch?: string;

    // X2 Large Compute is not available in new accounts.
    readonly enableXLCompute?: boolean;

    // ecs to trigger restart after build
    readonly ecsCacheFargateService: ecs.IBaseService;
}

export class CachePipeline extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: CachePipelineProps) {
        super(scope, id, { ...props });

        const compute = props.enableXLCompute ? ComputeType.X2_LARGE : ComputeType.LARGE;

        const cacheSourceOutput = new codepipeline.Artifact('CacheSourceArtifact');
        const cacheSourceAction = new codepipeline_actions.CodeCommitSourceAction({
            actionName: 'Source',
            repository: Repository.fromRepositoryName(this, 'Repo', props.cacheRepo),
            output: cacheSourceOutput,
            branch: props.cacheRepoBranch ?? 'mainline',
        });

        const buildRunPipeline = new PipelineProject(this, 'BuildCacheDocker', {
            buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
            environment: {
                computeType: compute,
                buildImage: LinuxBuildImage.STANDARD_5_0,
                // privileged = true is needed in order to run docker build:
                privileged: true,
            },
            environmentVariables: {
                // It is expected that our buildspec.yml in our source code will reference
                // this environment variable to determine which ECR repo to push the built image.
                ECR_REPOSITORY_URI: {
                    type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                    value: props.repository.repositoryUri,
                },
            },
            timeout: cdk.Duration.hours(8),
        });
        props.repository.grantPullPush(buildRunPipeline);

        const buildOutput = new codepipeline.Artifact('CACHEImageBuildOutput');
        const buildRunAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'Build',
            project: buildRunPipeline,
            input: cacheSourceOutput,
            outputs: [buildOutput],
        });

        const deployAction = new codepipeline_actions.EcsDeployAction({
            actionName: 'Deploy',
            service: props.ecsCacheFargateService,
            input: buildOutput,
        });

        new codepipeline.Pipeline(this, 'CacheDockerGenPipeline', {
            pipelineName: 'CacheDockerGenPipeline',
            stages: [
                {
                    stageName: 'Source',
                    actions: [cacheSourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [buildRunAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                },
            ],
        });
    }
}
