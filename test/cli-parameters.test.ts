import { jest } from '@jest/globals'

jest.unstable_mockModule('tempfile', () => {
  return {
    default: jest.fn(() => '/tmp/dummy-temp-file.png'),
  }
})

const { parse } = await import('../src/cli-parameters.js')
const { ErrorCode } = await import('../src/errors.js')

describe('CLI Parameters', () => {
  it('parses valid platform ios', () => {
    const result = parse(['ios'])
    expect(result.platform).toBe('ios')
    expect(result.useClipboard).toBe(true)
    expect(result.filename).toBe('/tmp/dummy-temp-file.png')
    expect(result.device).toBeUndefined()
  })

  it('parses valid platform android with filename', () => {
    const result = parse(['android', '-f', 'my-shot.png'])
    expect(result.platform).toBe('android')
    expect(result.useClipboard).toBe(false)
    expect(result.filename).toBe('my-shot.png')
  })

  it('parses device flag', () => {
    const result = parse(['ios', '-d', 'my-device-id'])
    expect(result.device).toBe('my-device-id')
  })

  it('throws error when platform is missing', () => {
    expect(() => parse([])).toThrow(
      expect.objectContaining({ code: ErrorCode.MissingPlatform })
    )
  })

  it('throws error when platform is invalid', () => {
    expect(() => parse(['windows'])).toThrow(
      expect.objectContaining({ code: ErrorCode.InvalidPlatform })
    )
  })
})
