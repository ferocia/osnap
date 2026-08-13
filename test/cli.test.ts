import { jest } from '@jest/globals'

const mockParse = jest.fn<(...args: any[]) => any>()
const mockIosSave = jest.fn<(...args: any[]) => Promise<any>>()
const mockAndroidSave = jest.fn<(...args: any[]) => Promise<any>>()
const mockCopyToClipboard = jest.fn<(...args: any[]) => Promise<any>>()

jest.unstable_mockModule('../src/cli-parameters.js', () => {
  return {
    parse: mockParse,
  }
})

jest.unstable_mockModule('../src/ios.js', () => {
  return {
    saveToFile: mockIosSave,
  }
})

jest.unstable_mockModule('../src/android.js', () => {
  return {
    saveToFile: mockAndroidSave,
  }
})

jest.unstable_mockModule('../src/copy-to-clipboard.js', () => {
  return {
    copyToClipboard: mockCopyToClipboard,
  }
})

const { run } = await import('../src/cli.js')
const { usage } = await import('../src/cli-usage.js')
const { ErrorCode, createError } = await import('../src/errors.js')

describe('CLI Orchestrator', () => {
  let logSpy: any
  let errorSpy: any

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => { })
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { })
  })

  afterEach(() => {
    mockParse.mockReset()
    mockIosSave.mockReset()
    mockAndroidSave.mockReset()
    mockCopyToClipboard.mockReset()
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('successfully runs the iOS path and copies to clipboard', async () => {
    mockParse.mockReturnValue({
      platform: 'ios',
      filename: 'ios.png',
      useClipboard: true,
    })
    mockIosSave.mockResolvedValue(undefined)
    mockCopyToClipboard.mockResolvedValue(true)

    const exitCode = await run()
    expect(exitCode).toBe(0)
    expect(mockIosSave).toHaveBeenCalledWith({
      platform: 'ios',
      filename: 'ios.png',
      useClipboard: true,
    })
    expect(mockCopyToClipboard).toHaveBeenCalledWith('ios.png')
  })

  it('successfully runs the Android path and skips clipboard', async () => {
    mockParse.mockReturnValue({
      platform: 'android',
      filename: 'android.png',
      useClipboard: false,
    })
    mockAndroidSave.mockResolvedValue(undefined)

    const exitCode = await run()
    expect(exitCode).toBe(0)
    expect(mockAndroidSave).toHaveBeenCalledWith({
      platform: 'android',
      filename: 'android.png',
      useClipboard: false,
    })
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it('prints usage and exits 0 on MissingPlatform error', async () => {
    mockParse.mockImplementation(() => {
      throw createError(ErrorCode.MissingPlatform)
    })

    const exitCode = await run()
    expect(exitCode).toBe(0)
    expect(logSpy).toHaveBeenCalledWith(usage)
  })

  it('prints error message and exits 1 on other errors', async () => {
    mockParse.mockImplementation(() => {
      throw createError(ErrorCode.ScreenshotFail)
    })

    const exitCode = await run()
    expect(exitCode).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'An unexpected error happened while taking a screenshot.'
    )
  })
})
