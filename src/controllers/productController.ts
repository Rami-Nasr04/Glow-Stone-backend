import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { getPathParam } from "../lib/request"
import { productIdSchema } from "../schemas/product.schema"
import { getProduct, listProducts } from "../services/productService"
import { handleError, ok } from "../views/response"

// GET /products: published products, newest first.
export const list = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    return ok(await listProducts())
  } catch (err) {
    return handleError(err)
  }
}

// GET /products/{id}: one published product.
export const get = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    return ok(await getProduct(id))
  } catch (err) {
    return handleError(err)
  }
}
