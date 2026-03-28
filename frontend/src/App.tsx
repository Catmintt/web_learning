import { useState } from 'react'
import './App.css'
import { Toaster } from 'sonner'
import fallbackHeroImg from './assets/hero.png'
import { loginAccount } from './services/auth'
import { PasswordField } from './components/PasswordField'
import { RegisterDialog } from './components/RegisterDialog'

const initialFormState = {
  identifier: '',
  password: '',
}

const generatedHeroImg = '/generated/login-hero-1.png'

/**
 * 渲染校园主题登录页，并维护最小表单交互状态。
 */
function App() {
  const [formState, setFormState] = useState(initialFormState)
  const [errorMessage, setErrorMessage] = useState('')
  const [helperMessage, setHelperMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [heroImg, setHeroImg] = useState(generatedHeroImg)
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  /**
   * 更新指定字段，并在继续输入时清空错误提示。
   */
  function handleFieldChange(
    field: keyof typeof initialFormState,
    value: string,
  ) {
    setFormState((currentState) => ({ ...currentState, [field]: value }))
    if (errorMessage) {
      setErrorMessage('')
    }
    if (helperMessage) {
      setHelperMessage('')
    }
  }

  /**
   * 校验表单输入，并调用后端登录接口。
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formState.identifier.trim() || !formState.password.trim()) {
      setErrorMessage('请输入有效账号信息')
      return
    }

    setErrorMessage('')
    setHelperMessage('')
    setIsSubmitting(true)

    try {
      const loginResponse = await loginAccount({
        account: formState.identifier.trim(),
        password: formState.password,
        rememberMe,
      })
      setHelperMessage(loginResponse.message)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '登录失败，请稍后再试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFilled =
    formState.identifier.trim().length > 0 && formState.password.trim().length > 0
  const sessionHint = rememberMe
    ? '当前已选择长期保持登录，除非主动退出，否则不会自动失效。'
    : '未勾选时默认保持登录一周；勾选后将持续登录，直到你主动退出。'

  return (
    <main className="campus-shell">
      <div className="campus-backdrop">
        <img
          src={heroImg}
          alt="校园林荫道与教学楼主视觉图"
          className="campus-backdrop-image"
          onError={() => setHeroImg(fallbackHeroImg)}
        />
        <div className="campus-backdrop-overlay" />
      </div>

      <section className="campus-copy" aria-label="校园背景信息">
        <p className="campus-kicker">晨光、林荫、教学楼</p>
        <h1>华侨大学热统小组</h1>
        <p className="campus-description">
          在清爽安静的界面里连接小组秘密基地。
        </p>
      </section>

      <section className="login-card-section">
        <div className="login-card">
          <p className="card-eyebrow">Campus access</p>
          <h2>欢迎回来</h2>
          <p className="card-description">
            登录后进入图像处理中心
          </p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="field-group" htmlFor="identifier">
              <span className="field-label">账号</span>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                className={errorMessage ? 'field-input field-input-error' : 'field-input'}
                value={formState.identifier}
                onChange={(event) =>
                  handleFieldChange('identifier', event.target.value)
                }
                placeholder="请输入账号"
              />
            </label>

            <PasswordField
              id="password"
              name="password"
              label="密码"
              autoComplete="current-password"
              value={formState.password}
              hasError={Boolean(errorMessage)}
              onChange={(value) => handleFieldChange('password', value)}
              placeholder="请输入密码"
            />

            <div className="form-meta">
              <label className="remember-me-field" htmlFor="remember-me">
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>记住我</span>
              </label>
              <button
                type="button"
                className="text-action-button"
                onClick={() => setIsRegisterDialogOpen(true)}
              >
                注册
              </button>
            </div>

            {errorMessage ? (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            ) : (
              <p className="form-hint">
                {helperMessage || sessionHint}
              </p>
            )}

            <button
              type="submit"
              className="submit-button"
              data-filled={isFilled}
              disabled={isSubmitting}
            >
              {isSubmitting ? '正在进入...' : '进入热统小组'}
            </button>
          </form>
        </div>
      </section>

      <RegisterDialog
        isOpen={isRegisterDialogOpen}
        onClose={() => setIsRegisterDialogOpen(false)}
      />
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3000}
      />
    </main>
  )
}

export default App
