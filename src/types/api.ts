export interface ApiError {
  code: string
  message: string
  // Only on order refusals about one piece (UNAVAILABLE, PRICE_CHANGED): the cart line to mark.
  productId?: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}
