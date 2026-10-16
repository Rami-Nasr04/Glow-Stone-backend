import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireAdmin } from "../lib/auth"
import { getPathParam, parseBody } from "../lib/request"
import { imageIdSchema, photoOrderSchema } from "../schemas/photo.schema"
import { productIdSchema } from "../schemas/product.schema"
import { deletePhoto, reorderPhotos, requestUpload } from "../services/adminPhotoService"
import { handleError, ok } from "../views/response"

// The photo routes that don't need sharp. The confirm step is adminPhotoUploadController (it runs with the sharp layer).

// POST /admin/products/{id}/photos/upload: permission to upload one photo straight to S3 for 5 minutes.
export const upload = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    return ok(await requestUpload(id))
  } catch (err) {
    return handleError(err)
  }
}

// PUT /admin/products/{id}/photos/order: { imageIds } = every photo of the piece, once, in the new order.
export const reorder = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    const { imageIds } = photoOrderSchema.parse(parseBody(event))
    return ok(await reorderPhotos(id, imageIds))
  } catch (err) {
    return handleError(err)
  }
}

// DELETE /admin/products/{id}/photos/{imageId}: 204; the later photos move up.
export const remove = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    const imageId = imageIdSchema.parse(getPathParam(event, "imageId") ?? "")
    await deletePhoto(id, imageId)
    return { statusCode: 204 }
  } catch (err) {
    return handleError(err)
  }
}
