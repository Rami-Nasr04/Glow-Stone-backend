// The public products API contract. The frontend mirrors it in src/features/catalog/types.ts; change both together.

// One master photo. The website asks the image CDN for a size with `${url}/<480|960|1440|2048|2880>.webp`;
// width and height are the master's, so the page can reserve the photo's shape before it loads.
export interface ProductImage {
  url: string
  width: number
  height: number
}

export interface ProductSummary {
  id: number
  name: string
  stoneType: string
  color: string
  price: number
  bottles: number
  heightCm: number | null
  widthCm: number | null
  depthCm: number | null
  weightKg: number | null
  editionSize: number
  remaining: number
  soldOut: boolean
  featured: boolean
  summary: string | null
  createdAt: string
  /** In order: [0] is the cover, [1] the photo shown on hover. The list has the first 2; the detail has all. May be empty. */
  images: ProductImage[]
}

export interface Product extends ProductSummary {
  /** Paragraphs separated by a blank line. */
  story: string | null
}

// What the studio reads: every piece, drafts included.
export interface AdminProduct extends Product {
  status: "draft" | "published"
  updatedAt: string
}
