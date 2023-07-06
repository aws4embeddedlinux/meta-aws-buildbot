#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import { CacheRepoStack, CachePipeline, CacheEcrStack, CacheEcsStack } from './cache-server';
import { BuildBotConfig, BuildBotImageRepo, BuildBotPipeline, BuildBotServer, BuildBotFilesystem } from './buildbot';
import { DeveloperStages, FederateOIDC } from './constants';
import { Vpc, Cluster, ServiceDomain } from './stacks';

// Set up your CDK App
const app = new App();

const dev = true;

if (dev) {
    const devName = process.env.USER || '';

    const stageProps = DeveloperStages[devName];

    const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

    const terminationProtection = true;
    /// App stacks

    const vpc = new Vpc(app, 'Vpc', {
        env,
        terminationProtection,
    });

    const cluster = new Cluster(app, 'Cluster', {
        vpc: vpc.vpc,
        env,
        terminationProtection,
    });

    const serviceDomain = new ServiceDomain(app, 'ServiceNamespace', {
        vpc: vpc.vpc,
        env,
        terminationProtection,
    });

    const ssr = new CacheRepoStack(app, 'CacheRepo-Personal', {
        env,
        terminationProtection,
    });

    const ecr = new CacheEcrStack(app, 'CacheEcr-Personal', {
        env,
        terminationProtection,
    });

    const ecs = new CacheEcsStack(app, 'CacheEcs-Personal', {
        env,
        terminationProtection,
        repository: ecr.repo,
        cluster: cluster.cluster,
        vpc: vpc.vpc,
        namespace: serviceDomain.namespace,
    });

    const buildBotConfig = new BuildBotConfig(app, 'BuildBotConfig-Personal', {
        env,
        terminationProtection,
    });

    const buildBotImageRepo = new BuildBotImageRepo(app, 'BuildBotImageRepo-Personal', {
        env,
        terminationProtection,
    });
    const buildBotFilesystem = new BuildBotFilesystem(app, 'BuildBotFilesystem-Personal', {
        env,
        terminationProtection,
        vpc: vpc.vpc,
    });

    const buildBotServer = new BuildBotServer(app, 'BuildBotServer-Personal', {
        env,
        terminationProtection,
        vpc: vpc.vpc,
        cluster: cluster.cluster,
        serviceName: 'buildbot',
        imageRepository: buildBotImageRepo.repo,
        keypair: 'buildbot-key',
        filesystem: buildBotFilesystem.filesystem,
        accesspoint: buildBotFilesystem.accesspoint,
        useWebhookAPI: true,
        namespace: serviceDomain.namespace,
        oidcAction: FederateOIDC,
    });

    new BuildBotPipeline(app, 'BuildBotPipeline-Personal', {
        env,
        terminationProtection,
        bucket: buildBotConfig.bucket,
        bucketKey: 'admin-configuration/config.zip',
        service: buildBotServer.service,
        repo: buildBotImageRepo.repo,
        configrepo: buildBotConfig.configrepo,
        workersg: buildBotServer.workerSecurityGroup.securityGroupId,
        workerVpcSubnetID: buildBotServer.workerVpcSubnetID,
        loadBalancerDNS: buildBotServer.loadBalancerDNS,
        buildBotServerPrivateDNS: buildBotServer.buildBotServerPrivateDNS,
        workerSstateEfsFsID: buildBotServer.sstateFS.fileSystemId,
    });

    new CachePipeline(app, 'CachePipeline-Personal', {
        env,
        terminationProtection,
        repository: ecr.repo,
        cacheRepo: ssr.repo.repositoryName,
        ecsCacheFargateService: ecs.service,
    });
}

// End
