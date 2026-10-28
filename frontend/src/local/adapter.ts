import { AxiosError } from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ApiError } from './errors'
import { handleRequest } from './router'

function extractPath(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      return parsed.pathname + parsed.search
    } catch {
      return url
    }
  }
  return url
}

function parseBody(data: unknown): Record<string, any> | null {
  if (data === null || data === undefined || data === '') return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  if (typeof data === 'object') return data as Record<string, any>
  return null
}

function buildResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config,
    request: { local: true },
  }
}

/**
 * محوّل Axios يعمل بالكامل داخل المتصفح: يوجّه الطلبات إلى قاعدة البيانات المحلية
 * بدل الشبكة، ويحاكي أخطاء الخادم (401/404/400) بنفس الشكل.
 */
export const localAdapter: AxiosAdapter = async (config) => {
  const rawUrl = extractPath(config.url || '/')
  const [pathPart, queryPart = ''] = rawUrl.split('?')
  const params: Record<string, unknown> = {
    ...Object.fromEntries(new URLSearchParams(queryPart)),
    ...(config.params || {}),
  }
  // إزالة القيم الفارغة كما يفعل الخادم مع Query params الاختيارية
  for (const key of Object.keys(params)) {
    if (params[key] === undefined) delete params[key]
  }

  try {
    const data = await handleRequest(config.method || 'get', pathPart, params, parseBody(config.data))
    return buildResponse(config, data)
  } catch (err) {
    if (err instanceof ApiError) {
      const response: AxiosResponse = {
        data: { detail: err.detail },
        status: err.status,
        statusText: err.status === 401 ? 'Unauthorized' : err.status === 404 ? 'Not Found' : 'Error',
        headers: { 'content-type': 'application/json' },
        config,
        request: { local: true },
      }
      throw new AxiosError(err.detail, String(err.status), config, null, response)
    }
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع في التخزين المحلي'
    throw new AxiosError(message, 'ERR_LOCAL_STORAGE', config, null, undefined)
  }
}
