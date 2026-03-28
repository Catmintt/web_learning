export type ApiMessageResponse = {
  success: boolean
  message: string
}

export type SendCodePayload = {
  account: string
  email: string
}

export type RegisterPayload = {
  account: string
  email: string
  verificationCode: string
  password: string
  confirmPassword: string
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
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

    throw new Error('请求失败，请稍后再试')
  }

  return responseData as T
}

/**
 * 发送注册邮箱验证码。
 */
export function sendRegisterVerificationCode(
  payload: SendCodePayload,
): Promise<ApiMessageResponse> {
  return requestJson<ApiMessageResponse>('/api/register/send-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

/**
 * 提交完整注册请求。
 */
export function registerAccount(
  payload: RegisterPayload,
): Promise<ApiMessageResponse> {
  return requestJson<ApiMessageResponse>('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account: payload.account,
      email: payload.email,
      verification_code: payload.verificationCode,
      password: payload.password,
      confirm_password: payload.confirmPassword,
    }),
  })
}
