import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { IMAGE_PATH, IMAGE_WIDTHS } from "../lib/imageSizes"

interface QueryValue {
  value: string
  multiValue?: { value: string }[]
}

interface GuardRequest {
  uri: string
  querystring: Record<string, QueryValue>
}

// Runs the file exactly as CloudFront does: a plain script with a global `handler`.
const code = readFileSync(join(__dirname, "imageGuard.js"), "utf8")
const handler = new Function(`${code}\nreturn handler`)() as (event: { request: GuardRequest }) => unknown

const request = (uri: string, querystring: Record<string, QueryValue> = {}) => handler({ request: { uri, querystring } })
const PHOTO = "/products/3/k7f2q9ab12cd.webp"

describe("CloudFront image guard", () => {
  it("lets every allowed width through, keeping only w", () => {
    for (const w of IMAGE_WIDTHS) {
      expect(request(PHOTO, { w: { value: String(w) }, x: { value: "1" } })).toEqual({
        uri: PHOTO,
        querystring: { w: { value: String(w) } },
      })
    }
  })

  it("uses the same widths and path rule as the resizer", () => {
    expect(code).toContain(`const WIDTHS = ${JSON.stringify(IMAGE_WIDTHS.map(String))}`)
    expect(code).toContain(`/${IMAGE_PATH.source}/`)
  })

  it("refuses a missing, unknown or repeated width", () => {
    expect(request(PHOTO)).toEqual({ statusCode: 400, statusDescription: "Bad Request" })
    expect(request(PHOTO, { w: { value: "961" } })).toMatchObject({ statusCode: 400 })
    expect(request(PHOTO, { w: { value: "0960" } })).toMatchObject({ statusCode: 400 })
    // Names every JavaScript object has; a plain-object lookup would let them through.
    for (const value of ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"]) {
      expect(request(PHOTO, { w: { value } })).toMatchObject({ statusCode: 400 })
    }
    expect(request(PHOTO, { w: { value: "480", multiValue: [{ value: "480" }, { value: "960" }] } })).toMatchObject({
      statusCode: 400,
    })
  })

  it("refuses paths that are not a product master", () => {
    const paths = [
      "/products/1/../secret.webp",
      "/products/3/K7F2Q9AB12CD.webp",
      "/products/3/k7f2q9ab12cd.jpg",
      "/products/0/k7f2q9ab12cd.webp",
      "/products/k7f2q9ab12cd.webp",
      "/other/3/k7f2q9ab12cd.webp",
      "/",
    ]
    for (const uri of paths) {
      expect(request(uri, { w: { value: "960" } })).toMatchObject({ statusCode: 400 })
    }
  })
})
