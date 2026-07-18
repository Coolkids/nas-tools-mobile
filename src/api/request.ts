import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import NProgress from 'nprogress'

const FLASK_BASE = import.meta.env.VITE_FLASK_BASE || ''

const instance: AxiosInstance = axios.create({
  baseURL: FLASK_BASE,
  timeout: 0,
  withCredentials: true
})

instance.interceptors.request.use((config) => {
  NProgress.start()
  return config
})

instance.interceptors.response.use(
  (response) => {
    NProgress.done()
    return response
  },
  (error) => {
    NProgress.done()
    return Promise.reject(error)
  }
)

export interface DoResult {
  code?: number
  msg?: string
  retcode?: number
  retmsg?: string
  [key: string]: unknown
}

let needsLoginHandler: (() => void) | null = null

export function setNeedsLoginHandler(fn: () => void): void {
  needsLoginHandler = fn
}

function redirectToLogin(): void {
  if (needsLoginHandler) {
    needsLoginHandler()
  } else {
    const next = window.location.pathname + window.location.search
    window.location.href = `/login?redirect=${encodeURIComponent(next)}`
  }
}

export async function doAction<T = DoResult>(cmd: string, params: object = {}): Promise<T> {
  const form = new URLSearchParams()
  form.append('cmd', cmd)
  form.append('data', JSON.stringify(params))
  const resp = await instance.post<T>(`/do?random=${Math.random()}`, form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  const result = resp.data as unknown as DoResult
  if (result && result.code === -1 && result.msg === '用户未登录') {
    redirectToLogin()
    throw new Error('未登录')
  }
  return resp.data
}

export async function getJson<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const resp = await instance.get<T>(url, config)
  return resp.data
}

export async function postJson<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const resp = await instance.post<T>(url, data, config)
  return resp.data
}

export default instance
