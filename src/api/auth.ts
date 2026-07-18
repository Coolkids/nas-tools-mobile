import instance from './request'

export interface UserInfo {
  userid: number
  username: string
  userpris: string[]
}

interface LoginResult {
  code: number
  success: boolean
  message: string
  data?: { userid: number; username: string; userpris: string[] }
}

export async function login(username: string, password: string, remember = false): Promise<LoginResult> {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  if (remember) form.append('remember', '1')
  const resp = await instance.post<LoginResult>('/login_json', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  return resp.data
}

export async function logout(): Promise<{ code: number; success: boolean }> {
  const resp = await instance.post('/logout_json', {})
  return resp.data
}

export async function checkAuth(): Promise<boolean> {
  try {
    const form = new URLSearchParams()
    form.append('cmd', 'get_users')
    form.append('data', '{}')
    const resp = await instance.post<{ code: number; msg?: string }>(`/do?random=${Math.random()}`, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    return !(resp.data && resp.data.code === -1 && resp.data.msg === '用户未登录')
  } catch {
    return false
  }
}
