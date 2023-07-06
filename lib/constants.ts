import { OidcAction } from './buildbot';
import { SecretValue } from 'aws-cdk-lib';

interface DeveloperDNS {
    readonly superNovaZoneName: string;
    readonly superNovaZoneId: string;
    readonly dnsAccountId: string;
}

interface StageProps {
    readonly name: string;
    readonly accountId: string;
    readonly region: string;
    readonly org: string;
    readonly developerDns?: DeveloperDNS;
}

interface DevStages {
    [name: string]: StageProps;
}

export const DeveloperStages: DevStages = {
    glimsdal: {
        name: 'glimsdal',
        accountId: '649821364639',
        region: 'us-west-2',
        org: 'glimsdal',
        developerDns: {
            superNovaZoneId: 'Z05913182COOR61Q0UZRO',
            superNovaZoneName: 'glimsdal.people.aws.dev',
            dnsAccountId: '274048645864',
        },
    },
    throos: {
        name: 'throos',
        accountId: '743600277648',
        region: 'us-west-2',
        org: 'throos',
        developerDns: {
            superNovaZoneId: 'Z08427691VZ4BX9HVYBXB',
            superNovaZoneName: 'throos.people.aws.dev',
            dnsAccountId: '743600277648',
        },
    },
};

export const FederateOIDC: OidcAction = {
    issuer: 'https://idp-integ.federate.amazon.com',
    tokenEndpoint: 'https://idp-integ.federate.amazon.com/api/oauth2/v2/token',
    userInfoEndpoint: 'https://idp-integ.federate.amazon.com/api/oauth2/v1/userinfo',
    authorizationEndpoint: 'https://idp-integ.federate.amazon.com/api/oauth2/v1/authorize',
    clientId: 'buildbot-glimsdal-dev',
    clientSecret: SecretValue.secretsManager('oidc-token', {}),
};
