// CloudFront Function (viewer request, cloudfront-js-2.0) in front of the image resizer.
// Refuses anything but a product photo at an allowed width before it reaches the cache or the Lambda,
// and drops every other query parameter so junk can't create new cache entries.
// Keep WIDTHS and PATH equal to src/lib/imageSizes.ts (a test checks both).
// An array, not an object: a lookup like WIDTHS["constructor"] would find JavaScript's built-in keys.
const WIDTHS = ["480","960","1440","2048","2880"]
const PATH = /^\/products\/[1-9]\d{0,9}\/[a-z0-9]{12}\.webp$/

function handler(event) {
  const request = event.request
  const w = request.querystring.w
  if (!PATH.test(request.uri) || !w || w.multiValue || WIDTHS.indexOf(w.value) === -1) {
    return { statusCode: 400, statusDescription: "Bad Request" }
  }
  request.querystring = { w: { value: w.value } }
  return request
}
