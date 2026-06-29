import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { r2Endpoint, requireEnv } from "./config.mjs";

export function createR2Client() {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: r2Endpoint(accountId),
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function uploadVideoFile(client, bucket, key, filePath, contentType = "video/mp4") {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
    })
  );
}

export async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}
