import { useEffect, useState } from 'react'
import { PasswordField } from './PasswordField'
import {
  registerAccount,
  sendRegisterVerificationCode,
} from '../services/register'

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

/**
 * 渲染注册弹窗，并完成验证码发送与账号注册交互。
 */
export function RegisterDialog({ isOpen, onClose }: RegisterDialogProps) {
  const [formState, setFormState] = useState(initialRegisterForm)
  const [status, setStatus] = useState<RegisterStatus>('idle')
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [helperMessage, setHelperMessage] = useState('')

  useEffect(() => {
    if (!isOpen || status !== 'success') {
      return undefined
    }

    const closeTimer = window.setTimeout(() => {
      setFormState(initialRegisterForm)
      setStatus('idle')
      setErrorMessage('')
      setHelperMessage('')
      onClose()
    }, 1400)

    return () => {
      window.clearTimeout(closeTimer)
    }
  }, [isOpen, onClose, status])

  if (!isOpen) {
    return null
  }

  const isLocked = status !== 'idle'

  /**
   * 更新注册字段，并同步清理旧的错误提示。
   */
  function handleFieldChange(
    field: keyof typeof initialRegisterForm,
    value: string,
  ) {
    setFormState((currentState) => ({ ...currentState, [field]: value }))
    if (errorMessage) {
      setErrorMessage('')
    }
  }

  /**
   * 在关闭弹窗时重置注册状态，避免脏数据残留。
   */
  function handleClose() {
    if (isLocked || isSendingCode) {
      return
    }

    setFormState(initialRegisterForm)
    setStatus('idle')
    setErrorMessage('')
    setHelperMessage('')
    onClose()
  }

  /**
   * 发送邮箱验证码，并把后端返回信息展示给用户。
   */
  async function handleSendCode() {
    setErrorMessage('')
    setHelperMessage('')
    setIsSendingCode(true)

    try {
      const response = await sendRegisterVerificationCode({
        account: formState.account,
        email: formState.email,
      })
      setHelperMessage(response.message)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '验证码发送失败，请稍后再试',
      )
    } finally {
      setIsSendingCode(false)
    }
  }

  /**
   * 提交注册请求，并在成功后展示完成动效。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setHelperMessage('')
    setStatus('submitting')

    try {
      await registerAccount({
        account: formState.account,
        email: formState.email,
        verificationCode: formState.verificationCode,
        password: formState.password,
        confirmPassword: formState.confirmPassword,
      })
      setStatus('success')
    } catch (error) {
      setStatus('idle')
      setErrorMessage(
        error instanceof Error ? error.message : '注册失败，请稍后再试',
      )
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
            disabled={isLocked || isSendingCode}
          >
            ×
          </button>
        </div>

        {status === 'success' ? (
          <div
            className="register-success-state"
            role="status"
            aria-label="注册成功"
          >
            <span className="success-checkmark" aria-hidden="true">
              <span className="success-checkmark-circle" />
              <span className="success-checkmark-stem" />
              <span className="success-checkmark-kick" />
            </span>
            <p className="register-success-title">注册完成</p>
            <p className="register-success-description">
              账号已写入系统，现在可以直接登录。
            </p>
          </div>
        ) : (
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
                  errorMessage ? 'field-input field-input-error' : 'field-input'
                }
                value={formState.account}
                disabled={isLocked || isSendingCode}
                onChange={(event) =>
                  handleFieldChange('account', event.target.value)
                }
                placeholder="仅英文和数字，不允许空格"
              />
            </label>

            <label className="field-group" htmlFor="register-email">
              <span className="field-label">邮箱</span>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                className={
                  errorMessage ? 'field-input field-input-error' : 'field-input'
                }
                value={formState.email}
                disabled={isLocked || isSendingCode}
                onChange={(event) =>
                  handleFieldChange('email', event.target.value)
                }
                placeholder="输入合法邮箱地址"
              />
            </label>

            <div className="verification-code-row">
              <label className="field-group verification-code-field" htmlFor="register-verification-code">
                <span className="field-label">邮箱验证码</span>
                <input
                  id="register-verification-code"
                  name="verificationCode"
                  type="text"
                  inputMode="numeric"
                  className={
                    errorMessage ? 'field-input field-input-error' : 'field-input'
                  }
                  value={formState.verificationCode}
                  disabled={isLocked}
                  onChange={(event) =>
                    handleFieldChange('verificationCode', event.target.value)
                  }
                  placeholder="输入 6 位验证码"
                />
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={handleSendCode}
                disabled={isLocked || isSendingCode}
              >
                {isSendingCode ? '发送中...' : '发送验证码'}
              </button>
            </div>

            <PasswordField
              id="register-password"
              name="password"
              label="注册密码"
              autoComplete="new-password"
              value={formState.password}
              hasError={Boolean(errorMessage)}
              disabled={isLocked}
              onChange={(value) => handleFieldChange('password', value)}
              placeholder="至少 8 位"
            />

            <PasswordField
              id="register-confirm-password"
              name="confirmPassword"
              label="确认密码"
              autoComplete="new-password"
              value={formState.confirmPassword}
              hasError={Boolean(errorMessage)}
              disabled={isLocked}
              onChange={(value) => handleFieldChange('confirmPassword', value)}
              placeholder="再次输入密码"
            />

            {errorMessage ? (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            ) : helperMessage ? (
              <p className="form-hint">{helperMessage}</p>
            ) : null}

            <button
              type="submit"
              className="submit-button register-submit-button"
              disabled={isLocked}
            >
              {status === 'submitting' ? '正在注册...' : '立即注册'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
