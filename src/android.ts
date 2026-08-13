import { CliParameters } from './cli-parameters.js'
import { ErrorCode, createError } from './errors.js'
import { existsSync, createWriteStream } from 'fs'
import { execa } from 'execa'
import { pipeline } from 'node:stream/promises'

/**
 * Finds the path to adb or throws an error.
 */
export function getAdbPath() {
  const androidHome = process.env['ANDROID_HOME']
  if (!androidHome) {
    throw createError(ErrorCode.MissingAndroidHome)
  }
  const adb = `${androidHome}/platform-tools/adb`
  if (!existsSync(adb)) {
    throw createError(ErrorCode.MissingAndroidAdb)
  }
  return adb
}

/**
 * Checks to see if a simulator is booted and ready to ask for a screen shot.
 *
 * @param adb The path to adb
 * @param device An optional target android device id
 */
export async function checkEmulator(adb: string, device?: string): Promise<string> {
  // get the list of simulators
  const response = await execa(adb, ['devices'])
  const stdout = response.stdout as string

  const devices = stdout
    .split('\n')
    .filter((line) => line.endsWith('\tdevice'))
    .map((line) => line.replace('\tdevice', ''))

  // not enough devices?
  if (devices.length === 0) {
    throw createError(ErrorCode.NoRunningAndroidEmulators)
  }

  // only 1 and no preference?  just pick that.
  if (devices.length === 1 && !device) {
    return devices[0]
  }

  // too many devices?
  if (devices.length > 1 && !device) {
    throw createError(ErrorCode.AmbiguousAndroidEmulator)
  }

  // can't find what the user is looking for?
  if (device && devices.indexOf(device) < 0) {
    throw createError(ErrorCode.MissingAndroidEmulator)
  }

  return device || devices[0]
}

/**
 * Takes a screenshot of the current running simulator and saves it to a file.
 *
 * @param adb The path to adb
 * @param device The android device id
 * @param filename The filename to save
 */
export async function saveScreenshot(adb: string, device: string, filename: string) {
  try {
    // up the max buffer size since these could be huge images
    const maxBuffer = 1024 * 1000 * 50 // 50 MB

    const adbProcess = execa(adb, ['-s', device, 'exec-out', 'screencap', '-p'], { maxBuffer })
    if (!adbProcess.stdout) {
      throw new Error('adb did not provide screenshot output')
    }

    await Promise.all([adbProcess, pipeline(adbProcess.stdout, createWriteStream(filename))])
  } catch {
    throw createError(ErrorCode.ScreenshotFail)
  }
}

/**
 * Runs the Android snapshot.
 *
 * @param parameters The CLI parameters
 */
export async function saveToFile(parameters: CliParameters) {
  const adb = getAdbPath()
  const device = await checkEmulator(adb, parameters.device)
  await saveScreenshot(adb, device, parameters.filename)
}
