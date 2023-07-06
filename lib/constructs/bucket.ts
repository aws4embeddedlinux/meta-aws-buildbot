import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface BucketProps extends cdk.StackProps {
    /**
     * The name of the inner S3 Bucket.
     *
     * @default A Cloudformation auto-generated name.
     */
    readonly bucketName?: string;
}

/**
 * An S3 Bucket with some secure default options set.
 */
export class Bucket extends Construct {
    /**
     * The inner S3 bucket.
     */
    readonly bucket: s3.IBucket;

    constructor(scope: Construct, id: string, props: BucketProps) {
        super(scope, id);
        const accessLogBucket = new s3.Bucket(this, 'AccessLogBucket', {});

        // TODO(glimsdal): Setup ACL for VPC endpoints: https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html
        this.bucket = new s3.Bucket(this, 'Bucket', {
            // Block all public access. Public Access is not required for this application.
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            // Note that this is not reversible without deleting the bucket.
            versioned: true,
            // Prevent regular HTTP traffic.
            enforceSSL: true,
            serverAccessLogsBucket: accessLogBucket,
            bucketName: props.bucketName,
        });
    }
}
