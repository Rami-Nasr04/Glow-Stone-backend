// CloudFront Function (viewer request, cloudfront-js-2.0) in front of the image resizer.
// Lets through only a product photo at an allowed width, before it reaches the cache or the Lambda,
// and wipes the query string so nothing else about the request can vary.
// Keep PATH equal to IMAGE_PATH in src/lib/imageSizes.ts (a test checks it).
const PATH = /^\/products\/([1-9]\d{0,9})\/([a-z0-9]{12})\/(480|960|1440|2048|2880)\.webp$/

function handler(event) {
  const request = event.request
  if (!PATH.test(request.uri)) {
    return { statusCode: 400, statusDescription: "Bad Request" }
  }
  request.querystring = {}
  return request
}
