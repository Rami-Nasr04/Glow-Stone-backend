import type { APIGatewayProxyStructuredResultV2, LambdaFunctionURLEvent } from "aws-lambda"
import { IMAGE_PATH } from "../lib/imageSizes"
import { readObject } from "../lib/s3"
import { resizeImage } from "../services/imageService"

const CACHE_YEAR = "public, max-age=31536000, immutable"
const CACHE_SHORT = "public, max-age=60"

const text = (statusCode: number, body: string): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "Content-Type": "text/plain", "Cache-Control": CACHE_SHORT },
  body,
})

// Function URL behind CloudFront: GET /products/<id>/<name>/<allowed width>.webp
// serves the master products/<id>/<name>.webp at that width. A Function URL answers with the same shape as API Gateway v2.
// The CloudFront guard already checked the path; this checks again in case the URL is ever reached another way.
export const resize = async (event: LambdaFunctionURLEvent): Promise<APIGatewayProxyStructuredResultV2> => {
  const match = IMAGE_PATH.exec(event.rawPath)
  if (!match) return text(400, "Bad request")
  const [, productId, name, width] = match
  try {
    const master = await readObject(process.env.IMAGES_BUCKET ?? "", `products/${productId}/${name}.webp`)
    if (!master) return text(404, "Not found")
    const image = await resizeImage(master, Number(width))
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/webp", "Cache-Control": CACHE_YEAR },
      body: image.toString("base64"),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error("Resize failed:", err)
    return text(500, "Internal error")
  }
}
