import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

// Module-level client, reused across warm invocations. Inside the VPC it reaches S3 through the S3 gateway endpoint.
export const s3 = new S3Client({})

// S3 only says "not found" to callers allowed to list the bucket (s3:ListBucket); otherwise it says AccessDenied.

// The object's bytes, or null when the key doesn't exist.
export async function readObject(bucket: string, key: string): Promise<Uint8Array | null> {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return object.Body ? await object.Body.transformToByteArray() : null
  } catch (err) {
    if (err instanceof NoSuchKey) return null
    throw err
  }
}

// The object's size in bytes, or null when the key doesn't exist.
export async function objectSize(bucket: string, key: string): Promise<number | null> {
  try {
    return (await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).ContentLength ?? null
  } catch (err) {
    if (err instanceof NotFound) return null
    throw err
  }
}

export async function writeObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
}

// Deleting a key that doesn't exist succeeds (S3 behaviour), so a retry is harmless.
export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
