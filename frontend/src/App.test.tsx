import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('登录页', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('注册弹窗支持发送验证码、双密码输入和成功注册动效', async () => {
    const fetchMock = vi.mocked(fetch)
    let resolveRegisterRequest: ((value: Response) => void) | undefined
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
        return new Promise<Response>((resolve) => {
          resolveRegisterRequest = resolve
        })
      }

      return Promise.reject(new Error('unexpected request'))
    })

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '注册' }))

    const dialog = screen.getByRole('dialog', { name: '注册热统小组账号' })
    expect(within(dialog).getByRole('textbox', { name: '注册账号' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: '邮箱' })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('textbox', { name: '邮箱验证码' }),
    ).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: '显示密码' })).toHaveLength(2)

    await user.type(within(dialog).getByRole('textbox', { name: '注册账号' }), 'alice01')
    await user.type(within(dialog).getByRole('textbox', { name: '邮箱' }), 'alice@example.com')
    await user.click(within(dialog).getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/register/send-code',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })
    expect(
      within(dialog).getByText('验证码已发送，请前往邮箱查收。'),
    ).toBeInTheDocument()

    await user.type(
      within(dialog).getByRole('textbox', { name: '邮箱验证码' }),
      '123456',
    )
    await user.type(
      within(dialog).getByLabelText('注册密码'),
      'password123',
    )
    await user.type(
      within(dialog).getByLabelText('确认密码'),
      'password123',
    )
    await user.click(within(dialog).getByRole('button', { name: '立即注册' }))

    expect(
      within(dialog).getByRole('button', { name: '正在注册...' }),
    ).toBeDisabled()

    resolveRegisterRequest?.({
      ok: true,
      json: async () => ({
        success: true,
        message: '注册成功，当前账号已经可以登录。',
      }),
    } as Response)

    expect(await screen.findByRole('status', { name: '注册成功' })).toBeInTheDocument()

    await waitFor(
      () => {
        expect(
          screen.queryByRole('dialog', { name: '注册热统小组账号' }),
        ).not.toBeInTheDocument()
      },
      { timeout: 2200 },
    )
  })
})
