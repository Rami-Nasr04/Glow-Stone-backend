// CloudFront Function (viewer request, cloudfront-js-2.0) in front of the image resizer.
// Refuses anything but a product photo at an allowed width before it reaches the cache or the Lambda,
// and drops every other query parameter so junk can't create new cache entries.
// Keep WIDTHS and PATH equal to src/lib/imageSizes.ts (a test checks both).
const WIDTHS = { "480": true, "960": true, "1440": true, "2048": true, "2880": true }
const PATH = /^\/products\/[1-9]\d{0,9}\/[a-z0-9]{12}\.webp$/

function handler(event) {
  const request = event.request
  const w = request.querystring.w
  if (!PATH.test(request.uri) || !w || w.multiValue || !WIDTHS[w.value]) {
    return { statusCode: 400, statusDescription: "Bad Request" }
  }
  request.querystring = { w: { value: w.value } }
  return request
}
