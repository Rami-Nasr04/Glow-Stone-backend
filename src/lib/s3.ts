import { GetObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3"

// Module-level client, reused across warm invocations.
const s3 = new S3Client({})

// The object's bytes, or null when the key doesn't exist.
// S3 only says "not found" to callers allowed to list the bucket (s3:ListBucket); otherwise it says AccessDenied.
export async function readObject(bucket: string, key: string): Promise<Uint8Array | null> {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return object.Body ? await object.Body.transformToByteArray() : null
  } catch (err) {
    if (err instanceof NoSuchKey) return null
    throw err
  }
}
