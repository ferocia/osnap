import { jest } from '@jest/globals'

const mockWhich = jest.fn<(...args: any[]) => Promise<any>>()
const mockExeca = jest.fn<(...args: any[]) => Promise<any>>()

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

const { getXcrunPath, checkSimulator, saveScreenshot, saveToFile } = await import('../src/ios.js')
const { ErrorCode } = await import('../src/errors.js')

describe('iOS Screenshot Module', () => {
  afterEach(() => {
    mockWhich.mockReset()
    mockExeca.mockReset()
  })

  describe('getXcrunPath', () => {
    it('returns path if xcrun exists', async () => {
      mockWhich.mockResolvedValue('/usr/bin/xcrun')
      const path = await getXcrunPath()
      expect(path).toBe('/usr/bin/xcrun')
      expect(mockWhich).toHaveBeenCalledWith('xcrun')
    })

    it('throws MissingXcrun if xcrun is not found', async () => {
      mockWhich.mockRejectedValue(new Error('not found'))
      await expect(getXcrunPath()).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.MissingXcrun })
      )
    })
  })

  describe('checkSimulator', () => {
    it('resolves the single booted device if no ID preferred', async () => {
      const mockDeviceList = `
== Devices ==
-- iOS 17.0 --
    iPhone 15 (86717551-0A8E-4545-98AF-A1207F106977) (Booted)
      `
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)
      const deviceId = await checkSimulator('/usr/bin/xcrun')
      expect(deviceId).toBe('86717551-0A8E-4545-98AF-A1207F106977')
    })

    it('throws NoRunningiOSSimulators if no devices are booted', async () => {
      mockExeca.mockResolvedValue({ stdout: '== Devices ==\nNo booted devices' } as any)
      await expect(checkSimulator('/usr/bin/xcrun')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.NoRunningiOSSimulators })
      )
    })

    it('throws AmbiguousiOSSimulator if multiple booted and no preferred ID', async () => {
      const mockDeviceList = `
    iPhone 15 (86717551-0A8E-4545-98AF-A1207F106977) (Booted)
    iPhone 15 Pro (99917551-0A8E-4545-98AF-A1207F106977) (Booted)
      `
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)
      await expect(checkSimulator('/usr/bin/xcrun')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.AmbiguousiOSSimulator })
      )
    })

    it('returns selected simulator if booted and requested', async () => {
      const mockDeviceList = `
    iPhone 15 (86717551-0A8E-4545-98AF-A1207F106977) (Booted)
    iPhone 15 Pro (99917551-0A8E-4545-98AF-A1207F106977) (Booted)
      `
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)
      const targetId = '99917551-0A8E-4545-98AF-A1207F106977'
      const result = await checkSimulator('/usr/bin/xcrun', targetId)
      expect(result).toBe(targetId)
    })

    it('throws MissingiOSSimulator if selected simulator is not booted', async () => {
      const mockDeviceList = `
    iPhone 15 (86717551-0A8E-4545-98AF-A1207F106977) (Booted)
      `
      mockExeca.mockResolvedValue({ stdout: mockDeviceList } as any)
      await expect(checkSimulator('/usr/bin/xcrun', '99917551-0A8E-4545-98AF-A1207F106977')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.MissingiOSSimulator })
      )
    })
  })

  describe('saveScreenshot', () => {
    it('executes simctl io screenshot command', async () => {
      mockExeca.mockResolvedValue({} as any)
      await saveScreenshot('/usr/bin/xcrun', 'booted', 'out.png')
      expect(mockExeca).toHaveBeenCalledWith('/usr/bin/xcrun', [
        'simctl',
        'io',
        'booted',
        'screenshot',
        'out.png',
      ])
    })

    it('throws ScreenshotFail if command throws', async () => {
      mockExeca.mockRejectedValue(new Error('fail'))
      await expect(saveScreenshot('/usr/bin/xcrun', 'booted', 'out.png')).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.ScreenshotFail })
      )
    })
  })

  describe('saveToFile orchestration', () => {
    it('combines getXcrun, checkSimulator and saveScreenshot', async () => {
      mockWhich.mockResolvedValue('/usr/bin/xcrun')
      const mockDeviceList = `iPhone 15 (86717551-0A8E-4545-98AF-A1207F106977) (Booted)`
      mockExeca.mockResolvedValueOnce({ stdout: mockDeviceList } as any) // checkSimulator
      mockExeca.mockResolvedValueOnce({} as any) // saveScreenshot

      await saveToFile({ filename: 'res.png', useClipboard: false, platform: 'ios' })
      expect(mockWhich).toHaveBeenCalledWith('xcrun')
      expect(mockExeca).toHaveBeenNthCalledWith(1, '/usr/bin/xcrun', [
        'simctl',
        'list',
        'devices',
      ])
      expect(mockExeca).toHaveBeenNthCalledWith(2, '/usr/bin/xcrun', [
        'simctl',
        'io',
        '86717551-0A8E-4545-98AF-A1207F106977',
        'screenshot',
        'res.png',
      ])
    })
  })
})
