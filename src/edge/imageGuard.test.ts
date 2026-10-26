import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { IMAGE_PATH, IMAGE_WIDTHS } from "../lib/imageSizes"

interface GuardRequest {
  uri: string
  querystring: Record<string, { value: string }>
}

// Runs the file exactly as CloudFront does: a plain script with a global `handler`.
const code = readFileSync(join(__dirname, "imageGuard.js"), "utf8")
const handler = new Function(`${code}\nreturn handler`)() as (event: { request: GuardRequest }) => unknown

const request = (uri: string, querystring: GuardRequest["querystring"] = {}) => handler({ request: { uri, querystring } })
const PHOTO = "/products/3/k7f2q9ab12cd"

describe("CloudFront image guard", () => {
  it("lets every allowed width through and wipes the query string", () => {
    for (const w of IMAGE_WIDTHS) {
      expect(request(`${PHOTO}/${w}.webp`, { nocache: { value: "123" } })).toEqual({
        uri: `${PHOTO}/${w}.webp`,
        querystring: {},
      })
    }
  })

  // 720 is for phones: a collection card needs about 520–650 px there, and 960 was more than it needed.
  it("serves six sizes from 480 to 2880, with 720 for phones", () => {
    expect(IMAGE_WIDTHS).toEqual([480, 720, 960, 1440, 2048, 2880])
  })

  it("uses the same rule as the resizer, built from the allowed widths", () => {
    expect(code).toContain(`const PATH = /${IMAGE_PATH.source}/`)
    expect(IMAGE_PATH.source).toContain(`(${IMAGE_WIDTHS.join("|")})`)
  })

  it("refuses other widths", () => {
    for (const w of ["961", "0960", "96", "9600", "constructor", ""]) {
      expect(request(`${PHOTO}/${w}.webp`)).toEqual({ statusCode: 400, statusDescription: "Bad Request" })
    }
  })

  it("refuses paths that are not a sized product photo", () => {
    const paths = [
      "/products/3/k7f2q9ab12cd.webp",
      "/products/3/k7f2q9ab12cd/960.jpg",
      "/products/3/k7f2q9ab12cd/960.webp/x",
      "/products/1/../k7f2q9ab12cd/960.webp",
      "/products/3/K7F2Q9AB12CD/960.webp",
      "/products/0/k7f2q9ab12cd/960.webp",
      "/products/k7f2q9ab12cd/960.webp",
      "/other/3/k7f2q9ab12cd/960.webp",
      "/",
    ]
    for (const uri of paths) {
      expect(request(uri)).toMatchObject({ statusCode: 400 })
    }
  })
})
