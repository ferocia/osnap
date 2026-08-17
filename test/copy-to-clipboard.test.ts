import { jest } from '@jest/globals'

const mockExeca = jest.fn<(...args: any[]) => Promise<any>>()

jest.unstable_mockModule('execa', () => {
  return {
    execa: mockExeca,
  }
})

const { copyToClipboard } = await import('../src/copy-to-clipboard.js')
const { ErrorCode } = await import('../src/errors.js')

describe('Copy to Clipboard', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    })
    mockExeca.mockReset()
  })

  it('throws ClipboardPlatformUnsupported on non-darwin systems', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    await expect(copyToClipboard('test.png')).rejects.toThrow(
      expect.objectContaining({ code: ErrorCode.ClipboardPlatformUnsupported })
    )
  })

  it('executes pbcopyimg utility on macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    mockExeca.mockResolvedValue({} as any)

    const result = await copyToClipboard('test.png')
    expect(result).toBe(true)
    expect(mockExeca).toHaveBeenCalledWith(
      expect.stringContaining('macos/pbcopyimg'),
      ['test.png']
    )
  })

  it('throws CopyToClipboardFail if utility execution throws', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    mockExeca.mockRejectedValue(new Error('Spawn failed'))

    await expect(copyToClipboard('test.png')).rejects.toThrow(
      expect.objectContaining({ code: ErrorCode.CopyToClipboardFail })
    )
  })
})
