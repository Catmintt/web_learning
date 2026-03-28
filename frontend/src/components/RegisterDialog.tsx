import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PasswordField } from './PasswordField'
import {
  registerAccount,
  RegisterRequestError,
  sendRegisterVerificationCode,
} from '../services/register'
import type { RegisterFieldErrors } from '../services/register'

type RegisterDialogProps = {
  isOpen: boolean
  onClose: () => void
}

type RegisterStatus = 'idle' | 'submitting' | 'success'

const initialRegisterForm = {
  account: '',
  email: '',
  verificationCode: '',
  password: '',
  confirmPassword: '',
}

const SEND_CODE_COOLDOWN_SECONDS = 60
const RETURN_COUNTDOWN_SECONDS = 5

/**
 * 渲染注册弹窗，并完成验证码发送与账号注册交互。
 */
export function RegisterDialog({ isOpen, onClose }: RegisterDialogProps) {
  const [formState, setFormState] = useState(initialRegisterForm)
  const [status, setStatus] = useState<RegisterStatus>('idle')
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [sendCodeCooldownSeconds, setSendCodeCooldownSeconds] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [formError, setFormError] = useState('')
  const successCloseTimerRef = useRef<number | null>(null)
  const successToastIntervalRef = useRef<number | null>(null)
  const sendCodeCooldownIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      clearSuccessCloseTimer()
      clearSuccessToastInterval()
      clearSendCodeCooldownInterval()
    }
  }, [])

  if (!isOpen) {
    return null
  }

  const isBusy = status === 'submitting' || isSendingCode
  const isReadOnly = isBusy || status === 'success'

  /**
   * 清理成功后的自动关闭定时器。
   */
  function clearSuccessCloseTimer() {
    if (successCloseTimerRef.current === null) {
      return
    }

    window.clearTimeout(successCloseTimerRef.current)
    successCloseTimerRef.current = null
  }

  /**
   * 清理成功提示的倒计时间隔。
   */
  function clearSuccessToastInterval() {
    if (successToastIntervalRef.current === null) {
      return
    }

    window.clearInterval(successToastIntervalRef.current)
    successToastIntervalRef.current = null
  }

  /**
   * 清理验证码发送按钮的冷却倒计时。
   */
  function clearSendCodeCooldownInterval() {
    if (sendCodeCooldownIntervalRef.current === null) {
      return
    }

    window.clearInterval(sendCodeCooldownIntervalRef.current)
    sendCodeCooldownIntervalRef.current = null
  }

  /**
   * 重置弹窗中的输入与提示状态。
   */
  function resetDialogState() {
    clearSuccessCloseTimer()
    clearSuccessToastInterval()
    clearSendCodeCooldownInterval()
    setFormState(initialRegisterForm)
    setStatus('idle')
    setIsSendingCode(false)
    setSendCodeCooldownSeconds(0)
    setFieldErrors({})
    setFormError('')
  }

  /**
   * 关闭弹窗并同步清理内部状态。
   */
  function closeDialog() {
    resetDialogState()
    onClose()
  }

  /**
   * 将结构化请求错误回填到对应字段或表单区域。
   */
  function applyRequestError(error: unknown, fallbackMessage: string) {
    if (error instanceof RegisterRequestError) {
      setFieldErrors(error.fieldErrors)
      setFormError(
        Object.keys(error.fieldErrors).length > 0 ? '' : error.message,
      )
      return
    }

    setFieldErrors({})
    setFormError(error instanceof Error ? error.message : fallbackMessage)
  }

  /**
   * 更新注册字段，并同步清理当前字段上的旧错误。
   */
  function handleFieldChange(
    field: keyof typeof initialRegisterForm,
    value: string,
  ) {
    setFormState((currentState) => ({ ...currentState, [field]: value }))
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })

    if (formError) {
      setFormError('')
    }
  }

  /**
   * 在关闭弹窗时重置注册状态，避免脏数据残留。
   */
  function handleClose() {
    if (isBusy) {
      return
    }

    closeDialog()
  }

  /**
   * 提前结束成功后的等待状态并返回登录界面。
   */
  function handleReturnToLogin() {
    closeDialog()
  }

  /**
   * 启动发送验证码后的 60 秒冷却倒计时。
   */
  function startSendCodeCooldown() {
    clearSendCodeCooldownInterval()
    setSendCodeCooldownSeconds(SEND_CODE_COOLDOWN_SECONDS)

    sendCodeCooldownIntervalRef.current = window.setInterval(() => {
      setSendCodeCooldownSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          clearSendCodeCooldownInterval()
          return 0
        }

        return currentSeconds - 1
      })
    }, 1000)
  }

  /**
   * 注册成功后弹出系统提示，并在 5 秒后自动关闭弹窗。
   */
  function handleRegisterSuccess() {
    setStatus('success')
    setFieldErrors({})
    setFormError('')
    clearSuccessCloseTimer()
    clearSuccessToastInterval()

    const toastId = toast.success('注册成功', {
      description: `将在 ${RETURN_COUNTDOWN_SECONDS} 秒后返回登录界面`,
      duration: RETURN_COUNTDOWN_SECONDS * 1000,
      action: {
        label: '立即返回',
        onClick: handleReturnToLogin,
      },
    })

    let countdownSeconds = RETURN_COUNTDOWN_SECONDS
    successToastIntervalRef.current = window.setInterval(() => {
      countdownSeconds -= 1
      if (countdownSeconds <= 0) {
        clearSuccessToastInterval()
        return
      }

      toast.success('注册成功', {
        id: toastId,
        description: `将在 ${countdownSeconds} 秒后返回登录界面`,
        duration: countdownSeconds * 1000,
        action: {
          label: '立即返回',
          onClick: handleReturnToLogin,
        },
      })
    }, 1000)

    successCloseTimerRef.current = window.setTimeout(() => {
      closeDialog()
    }, RETURN_COUNTDOWN_SECONDS * 1000)
  }

  /**
   * 发送邮箱验证码，并在成功后展示顶部系统提示。
   */
  async function handleSendCode() {
    setFieldErrors({})
    setFormError('')
    setIsSendingCode(true)

    try {
      await sendRegisterVerificationCode({
        account: formState.account,
        email: formState.email,
      })
      toast.success('验证码已发送，请检查邮箱', {
        duration: 5000,
      })
      startSendCodeCooldown()
    } catch (error) {
      applyRequestError(error, '验证码发送失败，请稍后再试')
    } finally {
      setIsSendingCode(false)
    }
  }

  /**
   * 提交注册请求，并在成功后展示系统提示。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFieldErrors({})
    setFormError('')
    setStatus('submitting')

    try {
      await registerAccount({
        account: formState.account,
        email: formState.email,
        verificationCode: formState.verificationCode,
        password: formState.password,
        confirmPassword: formState.confirmPassword,
      })
      handleRegisterSuccess()
    } catch (error) {
      setStatus('idle')
      applyRequestError(error, '注册失败，请稍后再试')
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="register-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-dialog-title"
        aria-label="注册热统小组账号"
      >
        <div className="register-dialog-header">
          <div>
            <p className="dialog-eyebrow">Join the group</p>
            <h3 id="register-dialog-title">注册热统小组账号</h3>
          </div>
          <button
            type="button"
            className="dialog-close-button"
            aria-label="关闭注册窗口"
            onClick={handleClose}
            disabled={isBusy}
          >
            ×
          </button>
        </div>

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <p className="register-description">
            使用英文或数字账号注册，邮箱验证码验证通过后即可创建账号。
          </p>

          <label className="field-group" htmlFor="register-account">
            <span className="field-label">注册账号</span>
            <input
              id="register-account"
              name="account"
              type="text"
              autoComplete="username"
              className={
                fieldErrors.account
                  ? 'field-input field-input-error'
                  : 'field-input'
              }
              value={formState.account}
              disabled={isReadOnly}
              onChange={(event) =>
                handleFieldChange('account', event.target.value)
              }
              placeholder="仅英文和数字，不允许空格"
            />
            {fieldErrors.account ? (
              <p className="field-error-message" role="alert">
                {fieldErrors.account}
              </p>
            ) : null}
          </label>

          <label className="field-group" htmlFor="register-email">
            <span className="field-label">邮箱</span>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              className={
                fieldErrors.email ? 'field-input field-input-error' : 'field-input'
              }
              value={formState.email}
              disabled={isReadOnly}
              onChange={(event) =>
                handleFieldChange('email', event.target.value)
              }
              placeholder="输入合法邮箱地址"
            />
            {fieldErrors.email ? (
              <p className="field-error-message" role="alert">
                {fieldErrors.email}
              </p>
            ) : null}
          </label>

          <div className="verification-code-row">
            <label
              className="field-group verification-code-field"
              htmlFor="register-verification-code"
            >
              <span className="field-label">邮箱验证码</span>
              <input
                id="register-verification-code"
                name="verificationCode"
                type="text"
                inputMode="numeric"
                className={
                  fieldErrors.verificationCode
                    ? 'field-input field-input-error'
                    : 'field-input'
                }
                value={formState.verificationCode}
                disabled={isReadOnly}
                onChange={(event) =>
                  handleFieldChange('verificationCode', event.target.value)
                }
                placeholder="输入 6 位验证码"
              />
              {fieldErrors.verificationCode ? (
                <p className="field-error-message" role="alert">
                  {fieldErrors.verificationCode}
                </p>
              ) : null}
            </label>
            <button
              type="button"
              className="secondary-button"
              onClick={handleSendCode}
              disabled={isReadOnly || sendCodeCooldownSeconds > 0}
            >
              {isSendingCode
                ? '发送中...'
                : sendCodeCooldownSeconds > 0
                  ? `${sendCodeCooldownSeconds}s 后重发`
                  : '发送验证码'}
            </button>
          </div>

          <PasswordField
            id="register-password"
            name="password"
            label="注册密码"
            autoComplete="new-password"
            value={formState.password}
            errorMessage={fieldErrors.password}
            disabled={isReadOnly}
            onChange={(value) => handleFieldChange('password', value)}
            placeholder="至少输入 1 个字符"
          />

          <PasswordField
            id="register-confirm-password"
            name="confirmPassword"
            label="确认密码"
            autoComplete="new-password"
            value={formState.confirmPassword}
            errorMessage={fieldErrors.confirmPassword}
            disabled={isReadOnly}
            onChange={(value) => handleFieldChange('confirmPassword', value)}
            placeholder="再次输入密码"
          />

          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            className="submit-button register-submit-button"
            disabled={status !== 'idle'}
          >
            {status === 'submitting'
              ? '正在注册...'
              : status === 'success'
                ? '注册成功，等待返回...'
                : '立即注册'}
          </button>
        </form>
      </section>
    </div>
  )
}
