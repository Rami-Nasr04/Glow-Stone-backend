import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireAdmin } from "../lib/auth"
import { getPathParam, parseBody } from "../lib/request"
import { productIdSchema, productInputSchema, productPatchSchema } from "../schemas/product.schema"
import { createProduct, deleteProduct, getAdminProduct, listAdminProducts, updateAdminProduct } from "../services/adminProductService"
import { handleError, ok } from "../views/response"

// GET /admin/products: every piece, drafts included, newest first.
export const list = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    return ok(await listAdminProducts())
  } catch (err) {
    return handleError(err)
  }
}

// GET /admin/products/{id}: one piece, whatever its status.
export const get = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    return ok(await getAdminProduct(id))
  } catch (err) {
    return handleError(err)
  }
}

// POST /admin/products: a new piece (a draft unless status says otherwise).
export const create = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const input = productInputSchema.parse(parseBody(event))
    return ok(await createProduct(input), 201)
  } catch (err) {
    return handleError(err)
  }
}

// PATCH /admin/products/{id}: changes only the fields sent; hiding a piece = { "status": "draft" }.
export const update = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    const changes = productPatchSchema.parse(parseBody(event))
    return ok(await updateAdminProduct(id, changes))
  } catch (err) {
    return handleError(err)
  }
}

// DELETE /admin/products/{id}: a draft with all its photos; a published piece answers 409.
export const remove = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    await deleteProduct(id)
    return { statusCode: 204 }
  } catch (err) {
    return handleError(err)
  }
}
