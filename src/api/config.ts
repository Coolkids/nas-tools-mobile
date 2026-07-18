import { doAction } from './request'

export type AppConfig = Record<string, Record<string, unknown>>

interface GetConfigResult {
  code: number
  msg?: string
  config: AppConfig
}

interface UpdateConfigResult {
  code: number
  msg?: string
}

export function getConfig(): Promise<GetConfigResult> {
  return doAction<GetConfigResult>('get_config', {})
}

export function updateConfig(items: Record<string, unknown>, test = false): Promise<UpdateConfigResult> {
  const params = { ...items, test }
  return doAction<UpdateConfigResult>('update_config', params)
}

export function testConnection(command: string): Promise<{ code: number; msg?: string }> {
  return doAction('test_connection', { command })
}

export function getSystemConfig(key: string): Promise<{ code: number; value: Record<string, unknown> }> {
  return doAction<{ code: number; value: Record<string, unknown> }>('get_system_config', { key })
}

export function setSystemConfig(key: string, value: unknown): Promise<{ code: number; msg?: string }> {
  return doAction('set_system_config', { key, value })
}

export function updateDirectory(oper: 'add' | 'sub', key: string, value: string): Promise<{ code: number }> {
  return doAction('update_directory', { oper, key, value })
}
