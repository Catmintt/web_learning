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

export type RegisterFieldName =
  | 'account'
  | 'email'
  | 'verificationCode'
  | 'password'
  | 'confirmPassword'

export type RegisterFieldErrors = Partial<Record<RegisterFieldName, string>>

type FastApiValidationDetail = {
  loc?: Array<string | number>
  msg?: string
}

type ApiErrorResponse = {
  detail?: string | FastApiValidationDetail[]
}

/**
 * 表示注册流程中的结构化请求错误。
 */
export class RegisterRequestError extends Error {
  status: number
  fieldErrors: RegisterFieldErrors

  constructor(
    message: string,
    status: number,
    fieldErrors: RegisterFieldErrors = {},
  ) {
    super(message)
    this.name = 'RegisterRequestError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/**
 * 统一移除后端校验文案前缀，避免把技术细节暴露给用户。
 */
function stripValidationPrefix(message: string): string {
  return message.replace(/^Value error,\s*/i, '').trim()
}

/**
 * 将后端字段名转换成前端表单字段名。
 */
function mapFieldName(fieldName: string): RegisterFieldName | null {
  switch (fieldName) {
    case 'account':
      return 'account'
    case 'email':
      return 'email'
    case 'verification_code':
    case 'verificationCode':
      return 'verificationCode'
    case 'password':
      return 'password'
    case 'confirm_password':
    case 'confirmPassword':
      return 'confirmPassword'
    default:
      return null
  }
}

/**
 * 将后端校验文案收敛成适合当前表单展示的中文提示。
 */
function normalizeFieldMessage(
  fieldName: RegisterFieldName,
  rawMessage: string,
): string {
  const message = stripValidationPrefix(rawMessage)

  if (fieldName === 'email') {
    return '邮箱格式不正确'
  }

  if (fieldName === 'account' && message.includes('账号只能包含英文和数字')) {
    return '账号只允许英文和数字'
  }

  if (fieldName === 'confirmPassword' && message.includes('两次输入的密码不一致')) {
    return '两次密码不一致'
  }

  return message
}

/**
 * 解析 FastAPI 的 422 校验错误数组。
 */
function parseValidationDetails(
  details: FastApiValidationDetail[],
): RegisterFieldErrors {
  return details.reduce<RegisterFieldErrors>((errors, detailItem) => {
    const fieldName = detailItem.loc?.[detailItem.loc.length - 1]
    if (typeof fieldName !== 'string' || typeof detailItem.msg !== 'string') {
      return errors
    }

    const mappedFieldName = mapFieldName(fieldName)
    if (!mappedFieldName || errors[mappedFieldName]) {
      return errors
    }

    errors[mappedFieldName] = normalizeFieldMessage(
      mappedFieldName,
      detailItem.msg,
    )
    return errors
  }, {})
}

/**
 * 将已知业务错误映射到具体输入区域。
 */
function parseStringDetail(
  detail: string,
): { fieldErrors: RegisterFieldErrors; message: string } {
  const normalizedDetail = stripValidationPrefix(detail)

  switch (normalizedDetail) {
    case '两次输入的密码不一致':
      return {
        fieldErrors: {
          confirmPassword: '两次密码不一致',
        },
        message: '两次密码不一致',
      }
    case '验证码错误或已过期':
      return {
        fieldErrors: {
          verificationCode: normalizedDetail,
        },
        message: normalizedDetail,
      }
    case '当前账号已存在':
      return {
        fieldErrors: {
          account: normalizedDetail,
        },
        message: normalizedDetail,
      }
    case '10 分钟内最多发送 5 次验证码，请稍后再试':
      return {
        fieldErrors: {
          email: normalizedDetail,
        },
        message: normalizedDetail,
      }
    default:
      return {
        fieldErrors: {},
        message: normalizedDetail,
      }
  }
}

/**
 * 将接口返回的错误载荷转换成结构化异常。
 */
function buildRegisterRequestError(
  status: number,
  responseData: ApiErrorResponse,
): RegisterRequestError {
  if (Array.isArray(responseData.detail)) {
    const fieldErrors = parseValidationDetails(responseData.detail)
    const message =
      Object.values(fieldErrors)[0] ?? '请求参数不合法，请检查后重试'
    return new RegisterRequestError(message, status, fieldErrors)
  }

  if (typeof responseData.detail === 'string') {
    const { fieldErrors, message } = parseStringDetail(responseData.detail)
    return new RegisterRequestError(message, status, fieldErrors)
  }

  return new RegisterRequestError('请求失败，请稍后再试', status)
}

/**
 * 发起请求并在失败时返回结构化注册错误。
 */
async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const responseData = (await response.json()) as ApiErrorResponse

  if (!response.ok) {
    throw buildRegisterRequestError(response.status, responseData)
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
