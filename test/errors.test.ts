import { ErrorCode, createError } from '../src/errors.js'

describe('Errors Module', () => {
  it('creates an OSnapError with correct code and default message', () => {
    const err = createError(ErrorCode.MissingPlatform)
    expect(err.code).toBe(ErrorCode.MissingPlatform)
    expect(err.message).toBe("Platform is required.  Must be 'ios' or 'android'.")
    expect(err.details).toBeUndefined()
  })

  it('attaches details when provided', () => {
    const err = createError(ErrorCode.InvalidPlatform, 'extra info')
    expect(err.code).toBe(ErrorCode.InvalidPlatform)
    expect(err.details).toBe('extra info')
  })
})
