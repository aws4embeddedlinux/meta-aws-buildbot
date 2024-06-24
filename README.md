# meta-aws-buildbot

This repository contains [buildbot](https://buildbot.net/) using [AWS CDK](https://aws.amazon.com/cdk/) to run [Yocto](https://www.yoctoproject.org/) embedded Linux build jobs in AWS.


## Code structure

This is a standard CDK project.

The main stack definition can be found in [`lib/app.ts`](lib/app.ts).


## Requirements and deployment

In order to be able to deploy this CDK project you need to have the following:

  - An AWS account
  - The [AWS CLI](https://aws.amazon.com/cli/) installed and configured in your development machine
  - [AWS CDK](https://aws.amazon.com/cdk/) installed and configured in your development machine
  - Node.js and npm installed

Then to deploy this CDK project to your AWS account, you simply have to clone this repository and from the root folder of the project run:

```bash
npm install
```

To install the necessary dependencies, and then:

```bash
npm run build
npm run zip-config
cdk deploy --all
```

To synthesise and deploy the project stack.

Then prompt `y` for yes.

If you want to clean up your account you can delete this stack with:

```bash
cdk destroy
```


## Contributing

Everyone is very welcome to contribute to this project.
You can contribute just by submitting bugs or suggesting improvements by
opening an issue on GitHub.

## useful commands

if you have a local buildbot you can check config before uploading it:

```bash
buildbot checkconfig configuration/admin/admin.cfg
```

deploy new config:
```bash
npm run zip-config && cdk deploy --force BuildBotConfig-Personal
```

debug ecs container:
```bash
aws ecs execute-command --cluster XXX --task XXX --container buildbot-server --interactive --command "/bin/bash"
```

rebuild, redeploy everything:
```bash
npm run clean && npm run build && npm run zip-config && cdk deploy --all --force --require-approval never
```

delete everything:
```bash
cdk destroy --all --require-approval never
```

## License

Licensed under [MIT License](LICENSE.md).
