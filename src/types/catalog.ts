// The public products API contract. The frontend mirrors it in src/features/catalog/types.ts; change both together.

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
}

export interface Product extends ProductSummary {
  /** Paragraphs separated by a blank line. */
  story: string | null
}
