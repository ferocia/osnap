import { jest } from '@jest/globals'
import { PassThrough, Writable } from 'node:stream'

const mockExistsSync = jest.fn<(...args: any[]) => boolean>()
const mockCreateWriteStream = jest.fn<(...args: any[]) => any>()
const mockExeca = jest.fn<(...args: any[]) => any>()

jest.unstable_mockModule('fs', () => {
  return {
    existsSync: mockExistsSync,
    createWriteStream: mockCreateWriteStream,
  }
})

jest.unstable_mockModule('execa', () => {
  return {
    execa: mockExeca,
  }
})

const { getAdbPath, checkEmulator, saveScreenshot, saveToFile } = await import('../src/android.js')
const { ErrorCode } = await import('../src/errors.js')

describe('Android Screenshot Module', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    // Reset process.env to original state
    for (const key in process.env) {
      delete process.env[key]
    }
    Object.assign(process.env, originalEnv)

    mockExistsSync.mockReset()
    mockCreateWriteStream.mockReset()
    mockExeca.mockReset()
  })

  describe('getAdbPath', () => {
    it('returns correct path if ANDROID_HOME is set and adb exists', () => {
      process.env['ANDROID_HOME'] = '/home/user/Android'
      mockExistsSync.mockReturnValue(true)

      const adb = getAdbPath()
      expect(adb).toBe('/home/user/Android/platform-tools/adb')
      expect(mockExistsSync).toHaveBeenCalledWith('/home/user/Android/platform-tools/adb')
    })

    it('throws MissingAndroidHome if ANDROID_HOME is missing', () => {
      delete process.env['ANDROID_HOME']
      expect(() => getAdbPath()).toThrow(
        expect.objectContaining({ code: ErrorCode.MissingAndroidHome })
      )
    })

    it('throws MissingAndroidAdb if ANDROID_HOME set but adb not existing', () => {
      process.env['ANDROID_HOME'] = '/home/user/Android'
      mockExistsSync.mockReturnValue(false)

      expect(() => getAdbPath()).toThrow(
        expect.objectContaining({ code: ErrorCode.MissingAndroidAdb })
      )
    })
  })

  describe('checkEmulator', () => {
    it('resolves first emulator if exactly one running', async () => {
      const mockDeviceList = 'List of devices attached\nemulator-5554\tdevice\n'
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)

      const dev = await checkEmulator('adb')
      expect(dev).toBe('emulator-5554')
    })

    it('throws NoRunningAndroidEmulators if no devices listed', async () => {
      mockExeca.mockResolvedValue({ stdout: 'List of devices attached\n\n' } as any)
      await expect(checkEmulator('adb')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.NoRunningAndroidEmulators })
      )
    })

    it('throws AmbiguousAndroidEmulator if multiple running and no preference ID', async () => {
      const mockDeviceList = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n'
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)

      await expect(checkEmulator('adb')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.AmbiguousAndroidEmulator })
      )
    })

    it('resolves preferred target if booted', async () => {
      const mockDeviceList = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n'
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)

      const dev = await checkEmulator('adb', 'emulator-5556')
      expect(dev).toBe('emulator-5556')
    })

    it('throws MissingAndroidEmulator if preferred target is not connected', async () => {
      const mockDeviceList = 'List of devices attached\nemulator-5554\tdevice\n'
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)

      await expect(checkEmulator('adb', 'emulator-5556')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.MissingAndroidEmulator })
      )
    })
  })

  describe('saveScreenshot', () => {
    it('creates adb command and resolves after screenshot output finishes writing', async () => {
      const stdout = new PassThrough()
      const mockAdbProcess = Object.assign(Promise.resolve({}), { stdout })
      mockExeca.mockReturnValue(mockAdbProcess as any)

      const mockWriteStream = new Writable({
        write(_chunk, _encoding, callback) {
          callback()
        },
      })
      mockCreateWriteStream.mockReturnValue(mockWriteStream as any)

      const save = saveScreenshot('adb', 'emulator-5554', 'out.png')
      let completed = false
      void save.then(() => {
        completed = true
      })
      await Promise.resolve()
      expect(completed).toBe(false)
      stdout.end('screenshot')
      await save

      expect(mockExeca).toHaveBeenCalledWith(
        'adb',
        ['-s', 'emulator-5554', 'exec-out', 'screencap', '-p'],
        { maxBuffer: 51200000 }
      )
      expect(mockCreateWriteStream).toHaveBeenCalledWith('out.png')
    })

    it('throws ScreenshotFail if adb process exits with non-zero code', async () => {
      const stdout = new PassThrough()
      stdout.end()
      const mockAdbProcess = Object.assign(Promise.reject(new Error('adb failed')), { stdout })
      mockExeca.mockReturnValue(mockAdbProcess as any)
      mockCreateWriteStream.mockReturnValue(new Writable({ write: (_chunk, _encoding, callback) => callback() }))

      await expect(saveScreenshot('adb', 'emulator-5554', 'out.png')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.ScreenshotFail })
      )
    })

    it('throws ScreenshotFail if adb cannot spawn', async () => {
      const stdout = new PassThrough()
      stdout.end()
      const mockAdbProcess = Object.assign(Promise.reject(new Error('spawn adb ENOENT')), { stdout })
      mockExeca.mockReturnValue(mockAdbProcess as any)
      mockCreateWriteStream.mockReturnValue(new Writable({ write: (_chunk, _encoding, callback) => callback() }))

      await expect(saveScreenshot('adb', 'emulator-5554', 'out.png')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.ScreenshotFail })
      )
    })

    it('throws ScreenshotFail if the screenshot file cannot be written', async () => {
      const stdout = new PassThrough()
      const mockAdbProcess = Object.assign(Promise.resolve({}), { stdout })
      mockExeca.mockReturnValue(mockAdbProcess as any)
      mockCreateWriteStream.mockReturnValue(
        new Writable({
          write(_chunk, _encoding, callback) {
            callback(new Error('disk full'))
          },
        }) as any
      )

      const save = saveScreenshot('adb', 'emulator-5554', 'out.png')
      stdout.end('screenshot')

      await expect(save).rejects.toThrow(expect.objectContaining({ code: ErrorCode.ScreenshotFail }))
    })

    it('throws ScreenshotFail if execa throws synchronous error', async () => {
      mockExeca.mockImplementation(() => {
        throw new Error('Sync error')
      })
      await expect(saveScreenshot('adb', 'emulator-5554', 'out.png')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.ScreenshotFail })
      )
    })
  })

  describe('saveToFile orchestration', () => {
    it('coordinates getAdbPath, checkEmulator, and saveScreenshot', async () => {
      process.env['ANDROID_HOME'] = '/home/user/Android'
      mockExistsSync.mockReturnValue(true) // adb exists

      const mockDevicesList = 'List of devices attached\nemulator-5554\tdevice\n'
      mockExeca.mockResolvedValueOnce({ stdout: mockDevicesList } as any) // adb devices

      const stdout = new PassThrough()
      stdout.end()
      const mockAdbProcess = Object.assign(Promise.resolve({}), { stdout })
      mockExeca.mockReturnValueOnce(mockAdbProcess as any) // saveScreenshot adb call
      mockCreateWriteStream.mockReturnValue(new Writable({ write: (_chunk, _encoding, callback) => callback() }))

      await saveToFile({ filename: 'out.png', useClipboard: false })
      expect(mockExistsSync).toHaveBeenCalled()
    })
  })
})
