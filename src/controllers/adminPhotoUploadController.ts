import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { requireAdmin } from "../lib/auth"
import { getPathParam, parseBody } from "../lib/request"
import { uploadBodySchema } from "../schemas/photo.schema"
import { productIdSchema } from "../schemas/product.schema"
import { confirmUpload } from "../services/photoUploadService"
import { handleError, ok } from "../views/response"

// POST /admin/products/{id}/photos { uploadId }: the uploaded photo becomes a master at the end of the piece (201).
// Its own file because it loads sharp: only this function has the sharp layer.
export const confirm = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    requireAdmin(event)
    const id = productIdSchema.parse(getPathParam(event, "id") ?? "")
    const { uploadId } = uploadBodySchema.parse(parseBody(event))
    return ok(await confirmUpload(id, uploadId), 201)
  } catch (err) {
    return handleError(err)
  }
}
