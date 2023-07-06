import * as cdk from 'aws-cdk-lib';
import { BuildEnvironmentVariableType, BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, EcsDeployAction, S3SourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { Repository } from 'aws-cdk-lib/aws-codecommit';
import { IBaseService } from 'aws-cdk-lib/aws-ecs';
import { IBucket } from 'aws-cdk-lib/aws-s3';

export interface BuildBotPipelineProps extends cdk.StackProps {
    readonly bucket: IBucket;
    readonly bucketKey: string;
    readonly service: IBaseService;
    readonly repo: IRepository;
    readonly configrepo: Repository;
    readonly workersg: string;
    readonly loadBalancerDNS: string;
    readonly buildBotServerPrivateDNS: string;
    readonly workerVpcSubnetID: string;
    readonly workerSstateEfsFsID: string;
}

export class BuildBotPipeline extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: BuildBotPipelineProps) {
        super(scope, id, { ...props });
        const sourceOutput = new Artifact('BuildBotSourceArtifact');
        const sourceAction = new S3SourceAction({
            actionName: 'BuildBot-Source',
            output: sourceOutput,
            bucket: props.bucket,
            bucketKey: props.bucketKey,
        });

        const buildBotBuildProject = new PipelineProject(this, 'BuildBotBuildProject', {
            buildSpec: BuildSpec.fromSourceFilename('buildspec.yml'),
            environment: {
                privileged: true,
                buildImage: LinuxBuildImage.STANDARD_6_0,
                environmentVariables: {
                    ECR_REPOSITORY_URI: {
                        type: BuildEnvironmentVariableType.PLAINTEXT,
                        value: props.repo.repositoryUri,
                    },
                    CODECOMMIT_REPOSITORY_CLONE_URL_GRC: {
                        type: BuildEnvironmentVariableType.PLAINTEXT,
                        value: props.configrepo.repositoryCloneUrlGrc,
                    },
                    BUILDBOT_WORKER_SECURITY_GROUP: {
                        type: BuildEnvironmentVariableType.PLAINTEXT,
                        value: props.workersg,
                    },
                    BUILDBOT_WORKER_SUBNET: {
                        type: BuildEnvironmentVariableType.PLAINTEXT,
                        value: props.workerVpcSubnetID,
                    },
                    BUILDBOT_WEB_URL: {
                        type: BuildEnvironmentVariableType.PLAINTEXT,
                        value: props.loadBalancerDNS,
                    },
                    BUILDBOT_WORKER_SSTATE_EFS_FS_ID: {
                        type: BuildEnvironmentVariableType.PLAINTEXT,
                        value: props.workerSstateEfsFsID,
                    },
                },
            },
        });
        props.repo.grantPullPush(buildBotBuildProject);
        props.configrepo.grantPull(buildBotBuildProject);

        const buildOutput = new Artifact('BuildBotBuildArtifact');
        const buildAction = new CodeBuildAction({
            actionName: 'BuildBot-Build',
            project: buildBotBuildProject,
            input: sourceOutput,
            outputs: [buildOutput],
        });
        const deployAction = new EcsDeployAction({
            actionName: 'BuildBot-Deploy',
            service: props.service,
            input: buildOutput,
        });

        const pipeline = new Pipeline(this, 'BuildBotDeployPipeline', {
            pipelineName: 'BuildBot-Image-Deploy',
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [buildAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                },
            ],
        });
        props.bucket.grantRead(pipeline.role);
    }
}
