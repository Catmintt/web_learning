import { useState } from 'react'

type PasswordFieldProps = {
  id: string
  name: string
  label: string
  value: string
  placeholder: string
  autoComplete?: string
  hasError?: boolean
  disabled?: boolean
  onChange: (value: string) => void
}

/**
 * 渲染带显隐按钮的密码输入框，支持点击切换与按住临时查看。
 */
export function PasswordField({
  id,
  name,
  label,
  value,
  placeholder,
  autoComplete,
  hasError = false,
  disabled = false,
  onChange,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  /**
   * 处理普通点击，切换密码显示状态。
   */
  function handleToggleClick() {
    if (disabled) {
      return
    }

    setIsVisible((currentState) => !currentState)
  }

  return (
    <label className="field-group" htmlFor={id}>
      <span className="field-label">{label}</span>
      <div className="password-field-wrap">
        <input
          id={id}
          name={name}
          type={isVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={hasError ? 'field-input field-input-error' : 'field-input'}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-visibility-button"
          aria-label={isVisible ? '隐藏密码' : '显示密码'}
          aria-pressed={isVisible}
          disabled={disabled}
          onClick={handleToggleClick}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="password-visibility-icon"
          >
            <path
              d="M2.2 12c2.4-4.1 5.8-6.2 9.8-6.2s7.4 2.1 9.8 6.2c-2.4 4.1-5.8 6.2-9.8 6.2S4.6 16.1 2.2 12Z"
              className="eye-outline"
            />
            <circle cx="12" cy="12" r="3.3" className="eye-pupil" />
            {isVisible ? null : (
              <path d="M4 20 20 4" className="eye-strike" />
            )}
          </svg>
        </button>
      </div>
    </label>
  )
}
