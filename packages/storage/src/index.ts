import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

export interface MinioConnectivityConfiguration {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
}

export interface MinioConnectivityResult {
  readonly service: 'minio';
  readonly status: 'connected';
  readonly operation: 'HEAD_BUCKET';
  readonly bucket: string;
}

export async function probeMinioConnectivity(
  configuration: MinioConnectivityConfiguration,
): Promise<MinioConnectivityResult> {
  const client = new S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: configuration.bucket,
      }),
    );

    return {
      service: 'minio',
      status: 'connected',
      operation: 'HEAD_BUCKET',
      bucket: configuration.bucket,
    };
  } finally {
    client.destroy();
  }
}
