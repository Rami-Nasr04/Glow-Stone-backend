import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { MAX_UPLOAD_BYTES, UPLOAD_EXPIRES_SECONDS } from "./photoRules"
import { s3 } from "./s3"

// Apart from lib/s3 so the image resizer never loads it. Like the rest of the AWS SDK, it comes from the
// Lambda runtime (Serverless leaves @aws-sdk/* out of the bundle).

export interface PresignedUpload {
  url: string
  fields: Record<string, string>
}

// A browser form upload straight into the bucket: exactly this key, an image type, 1 byte to 30 MB, for 5 minutes.
export function presignUpload(bucket: string, key: string): Promise<PresignedUpload> {
  return createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ["content-length-range", 1, MAX_UPLOAD_BYTES],
      ["starts-with", "$Content-Type", "image/"],
    ],
    Expires: UPLOAD_EXPIRES_SECONDS,
  })
}
