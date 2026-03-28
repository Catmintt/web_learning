import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const { toastSuccessMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
}))

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: {
    success: toastSuccessMock,
  },
}))

describe('登录页', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    toastSuccessMock.mockReturnValue('toast-id')
  })

  afterEach(() => {
    vi.useRealTimers()
    toastSuccessMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('渲染账号登录字段、记住我和主操作按钮', () => {
    render(<App />)

    expect(screen.getByText('华侨大学热统小组')).toBeInTheDocument()
    expect(screen.getByText('登录后进入图像处理中心')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '账号' })).toBeInTheDocument()
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '记住我' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '进入热统小组' }),
    ).toBeInTheDocument()
  })

  it('根据记住我状态切换登录保持时长提示', async () => {
    const user = userEvent.setup()
    render(<App />)

    const rememberMeCheckbox = screen.getByRole('checkbox', { name: '记住我' })

    expect(
      screen.getByText('未勾选时默认保持登录一周；勾选后将持续登录，直到你主动退出。'),
    ).toBeInTheDocument()

    await user.click(rememberMeCheckbox)

    expect(
      screen.getByText('当前已选择长期保持登录，除非主动退出，否则不会自动失效。'),
    ).toBeInTheDocument()
  })

  it('支持点击切换密码可见性', () => {
    render(<App />)

    const passwordInput = screen.getByLabelText('密码')
    const toggleButton = screen.getByRole('button', { name: '显示密码' })

    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: '隐藏密码' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('发送验证码时把邮箱格式错误显示在邮箱区域', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        detail: [
          {
            loc: ['body', 'email'],
            msg: 'value is not a valid email address',
          },
        ],
      }),
    } as Response)

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '注册' }))

    const dialog = screen.getByRole('dialog', { name: '注册热统小组账号' })
    const accountInput = within(dialog).getByRole('textbox', { name: '注册账号' })
    const emailInput = within(dialog).getByRole('textbox', { name: '邮箱' })

    await user.type(accountInput, 'alice01')
    await user.type(emailInput, 'bad-email')
    await user.click(within(dialog).getByRole('button', { name: '发送验证码' }))

    expect(await within(dialog).findByText('邮箱格式不正确')).toBeInTheDocument()
    expect(emailInput).toHaveClass('field-input-error')
    expect(accountInput).not.toHaveClass('field-input-error')
  })

  it('提交注册时把两次密码不一致显示在确认密码区域', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation((input) => {
      if (input === '/api/register') {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            detail: '两次输入的密码不一致',
          }),
        } as Response)
      }

      return Promise.reject(new Error('unexpected request'))
    })

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '注册' }))

    const dialog = screen.getByRole('dialog', { name: '注册热统小组账号' })
    const passwordInput = within(dialog).getByLabelText('注册密码')
    const confirmPasswordInput = within(dialog).getByLabelText('确认密码')

    await user.type(within(dialog).getByRole('textbox', { name: '注册账号' }), 'alice01')
    await user.type(within(dialog).getByRole('textbox', { name: '邮箱' }), 'alice@example.com')
    await user.type(within(dialog).getByRole('textbox', { name: '邮箱验证码' }), '123456')
    await user.type(passwordInput, 'password123')
    await user.type(confirmPasswordInput, 'password999')
    await user.click(within(dialog).getByRole('button', { name: '立即注册' }))

    expect(await within(dialog).findByText('两次密码不一致')).toBeInTheDocument()
    expect(confirmPasswordInput).toHaveClass('field-input-error')
    expect(passwordInput).not.toHaveClass('field-input-error')
  })

  it('发送验证码后按钮进入 60 秒倒计时，并把成功提示改到顶部 toast', async () => {
    const fetchMock = vi.mocked(fetch)
    vi.useFakeTimers()

    fetchMock.mockImplementation((input) => {
      if (input === '/api/register/send-code') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: '验证码已发送，请前往邮箱查收。',
          }),
        } as Response)
      }

      if (input === '/api/register') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: '注册成功，当前账号已经可以登录。',
          }),
        } as Response)
      }

      return Promise.reject(new Error('unexpected request'))
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '注册' }))

    const dialog = screen.getByRole('dialog', { name: '注册热统小组账号' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '注册账号' }), {
      target: { value: 'alice01' },
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '邮箱' }), {
      target: { value: 'alice@example.com' },
    })
    const sendCodeButton = within(dialog).getByRole('button', { name: '发送验证码' })
    fireEvent.click(sendCodeButton)

    await act(async () => {
      await Promise.resolve()
    })

    expect(toastSuccessMock).toHaveBeenCalledWith('验证码已发送，请检查邮箱', {
      duration: 5000,
    })

    expect(
      within(dialog).queryByText('验证码已发送，请前往邮箱查收。'),
    ).not.toBeInTheDocument()
    expect(sendCodeButton).toBeDisabled()
    expect(sendCodeButton).toHaveTextContent('60s 后重发')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(sendCodeButton).toHaveTextContent('59s 后重发')

    act(() => {
      vi.advanceTimersByTime(59000)
    })
    expect(sendCodeButton).not.toBeDisabled()
    expect(sendCodeButton).toHaveTextContent('发送验证码')
  })

  it('注册成功后使用 5 秒动态倒数 toast，并支持立即返回', async () => {
    const fetchMock = vi.mocked(fetch)
    vi.useFakeTimers()

    fetchMock.mockImplementation((input) => {
      if (input === '/api/register') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: '注册成功，当前账号已经可以登录。',
          }),
        } as Response)
      }

      return Promise.reject(new Error('unexpected request'))
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '注册' }))

    const dialog = screen.getByRole('dialog', { name: '注册热统小组账号' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '注册账号' }), {
      target: { value: 'alice01' },
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '邮箱' }), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '邮箱验证码' }), {
      target: { value: '123456' },
    })
    fireEvent.change(within(dialog).getByLabelText('注册密码'), {
      target: { value: 'a' },
    })
    fireEvent.change(within(dialog).getByLabelText('确认密码'), {
      target: { value: 'a' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '立即注册' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(toastSuccessMock).toHaveBeenCalledWith('注册成功', {
      description: '将在 5 秒后返回登录界面',
      duration: 5000,
      action: expect.objectContaining({
        label: '立即返回',
      }),
    })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(toastSuccessMock).toHaveBeenLastCalledWith('注册成功', {
      id: 'toast-id',
      description: '将在 4 秒后返回登录界面',
      duration: 4000,
      action: expect.objectContaining({
        label: '立即返回',
      }),
    })

    const toastOptions = toastSuccessMock.mock.calls.at(-1)?.[1] as
      | {
          action?: {
            label: string
            onClick: () => void
          }
        }
      | undefined

    act(() => {
      toastOptions?.action?.onClick()
    })

    expect(
      screen.queryByRole('dialog', { name: '注册热统小组账号' }),
    ).not.toBeInTheDocument()
  })

  it('注册成功后会在 5 秒后自动关闭弹窗', async () => {
    const fetchMock = vi.mocked(fetch)
    vi.useFakeTimers()

    fetchMock.mockImplementation((input) => {
      if (input === '/api/register') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: '注册成功，当前账号已经可以登录。',
          }),
        } as Response)
      }

      return Promise.reject(new Error('unexpected request'))
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '注册' }))

    const dialog = screen.getByRole('dialog', { name: '注册热统小组账号' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '注册账号' }), {
      target: { value: 'alice01' },
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '邮箱' }), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.change(within(dialog).getByRole('textbox', { name: '邮箱验证码' }), {
      target: { value: '123456' },
    })
    fireEvent.change(within(dialog).getByLabelText('注册密码'), {
      target: { value: 'password123' },
    })
    fireEvent.change(within(dialog).getByLabelText('确认密码'), {
      target: { value: 'password123' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '立即注册' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(toastSuccessMock).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(
      screen.queryByRole('dialog', { name: '注册热统小组账号' }),
    ).not.toBeInTheDocument()
  })
})
