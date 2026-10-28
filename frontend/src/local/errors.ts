export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export const notFound = (detail: string) => new ApiError(404, detail)
export const badRequest = (detail: string) => new ApiError(400, detail)
export const unauthorized = (detail = 'غير مسجل') => new ApiError(401, detail)
