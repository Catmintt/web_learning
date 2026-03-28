export type LoginPayload = {
  account: string
  password: string
  rememberMe: boolean
}

export type LoginResponse = {
  success: boolean
  message: string
  account: string
  remember_me: boolean
  session_days: number
}

/**
 * 调用后端登录接口，并返回当前会话策略说明。
 */
export async function loginAccount(
  payload: LoginPayload,
): Promise<LoginResponse> {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account: payload.account,
      password: payload.password,
      remember_me: payload.rememberMe,
    }),
  })

  const responseData = (await response.json()) as unknown
  if (!response.ok) {
    if (
      typeof responseData === 'object' &&
      responseData !== null &&
      'detail' in responseData &&
      typeof responseData.detail === 'string'
    ) {
      throw new Error(responseData.detail)
    }

    throw new Error('登录失败，请稍后再试')
  }

  return responseData as LoginResponse
}
