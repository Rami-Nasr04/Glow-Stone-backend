import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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

// Deletes every object whose key starts with prefix (a folder such as "products/13/"); returns how many.
// One list + one batch delete per 1,000 keys. A key S3 couldn't delete fails the whole call, so it gets logged.
export async function deleteFolder(bucket: string, prefix: string): Promise<number> {
  let deleted = 0
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }))
    const keys = (page.Contents ?? []).flatMap(({ Key }) => (Key ? [{ Key }] : []))
    if (keys.length > 0) {
      const result = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }))
      if (result.Errors?.length) throw new Error(`S3 kept ${result.Errors.length} of ${keys.length} files under ${prefix}`)
      deleted += keys.length
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return deleted
}
