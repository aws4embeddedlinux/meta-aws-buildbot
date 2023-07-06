# aws4embeddedlinux-build

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

Now, in order to deploy this CDK project to your AWS account, you simply have to clone this repository and from the root folder of the project run:

```bash
npm install
```

To install the necessary dependencies, and then:

```bash
npm run build
cdk deploy
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


## License

Licensed under [MIT License](LICENSE.md).