import { jest } from '@jest/globals'

const mockExistsSync = jest.fn<(...args: any[]) => boolean>()
const mockCreateWriteStream = jest.fn<(...args: any[]) => any>()
const mockWhich = jest.fn<(...args: any[]) => Promise<any>>()
const mockExeca = jest.fn<(...args: any[]) => any>()

jest.unstable_mockModule('fs', () => {
  return {
    existsSync: mockExistsSync,
    createWriteStream: mockCreateWriteStream,
  }
})

jest.unstable_mockModule('which', () => {
  return {
    default: mockWhich,
  }
})

jest.unstable_mockModule('execa', () => {
  return {
    execa: mockExeca,
  }
})

const { getAdbPath, getPerlPath, checkEmulator, saveScreenshot, saveToFile } = await import('../src/android.js')
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
    mockWhich.mockReset()
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

  describe('getPerlPath', () => {
    it('returns perl path if found', async () => {
      mockWhich.mockResolvedValue('/usr/bin/perl')
      const path = await getPerlPath()
      expect(path).toBe('/usr/bin/perl')
      expect(mockWhich).toHaveBeenCalledWith('perl')
    })

    it('throws MissingPerl if perl is not found', async () => {
      mockWhich.mockRejectedValue(new Error('not found'))
      await expect(getPerlPath()).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.MissingPerl })
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
    it('creates adb command, pipes stdout to write stream, and resolves on exit 0', async () => {
      const mockOn = jest.fn((event, cb: any) => {
        if (event === 'exit') {
          setImmediate(() => cb(0))
        }
      })
      const mockPipe = jest.fn()
      const mockAdbProcess = {
        stdout: { pipe: mockPipe },
        nodeChildProcess: { on: mockOn },
      }
      mockExeca.mockReturnValue(mockAdbProcess as any)

      const mockWriteStream = {}
      mockCreateWriteStream.mockReturnValue(mockWriteStream as any)

      await saveScreenshot('adb', 'perl', 'emulator-5554', 'out.png')

      expect(mockExeca).toHaveBeenCalledWith(
        'adb',
        ['-s', 'emulator-5554', 'exec-out', 'screencap', '-p'],
        { maxBuffer: 51200000 }
      )
      expect(mockPipe).toHaveBeenCalledWith(mockWriteStream)
      expect(mockOn).toHaveBeenCalledWith('exit', expect.any(Function))
    })

    it('rejects if adb process exits with non-zero code', async () => {
      const mockOn = jest.fn((event, cb: any) => {
        if (event === 'exit') {
          setImmediate(() => cb(1))
        }
      })
      const mockPipe = jest.fn()
      const mockAdbProcess = {
        stdout: { pipe: mockPipe },
        nodeChildProcess: { on: mockOn },
      }
      mockExeca.mockReturnValue(mockAdbProcess as any)

      await expect(saveScreenshot('adb', 'perl', 'emulator-5554', 'out.png')).rejects.toBeUndefined()
    })

    it('throws ScreenshotFail if execa throws synchronous error', async () => {
      mockExeca.mockImplementation(() => {
        throw new Error('Sync error')
      })
      await expect(saveScreenshot('adb', 'perl', 'emulator-5554', 'out.png')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.ScreenshotFail })
      )
    })
  })

  describe('saveToFile orchestration', () => {
    it('coordinates getAdbPath, getPerlPath, checkEmulator, and saveScreenshot', async () => {
      process.env['ANDROID_HOME'] = '/home/user/Android'
      mockExistsSync.mockReturnValue(true) // adb exists
      mockWhich.mockResolvedValue('/usr/bin/perl') // perl path

      const mockDevicesList = 'List of devices attached\nemulator-5554\tdevice\n'
      mockExeca.mockResolvedValueOnce({ stdout: mockDevicesList } as any) // adb devices

      const mockOn = jest.fn((event, cb: any) => {
        if (event === 'exit') {
          setImmediate(() => cb(0))
        }
      })
      const mockAdbProcess = {
        stdout: { pipe: jest.fn() },
        nodeChildProcess: { on: mockOn },
      }
      mockExeca.mockReturnValueOnce(mockAdbProcess as any) // saveScreenshot adb call

      await saveToFile({ filename: 'out.png', useClipboard: false })
      expect(mockExistsSync).toHaveBeenCalled()
      expect(mockWhich).toHaveBeenCalledWith('perl')
    })
  })
})
