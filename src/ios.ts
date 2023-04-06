import { CliParameters } from './cli-parameters';
import which from 'which';
import { ErrorCode, createError } from './errors';

/**
 * Finds the path to xcrun or throws an error.
 */
export async function getXcrunPath() {
  try {
    return await which('xcrun');
  } catch (err) {
    throw createError(ErrorCode.MissingXcrun);
  }
}

/**
 * Checks to see if a simulator is booted and ready to ask for a screen shot.
 *
 * @param xcrunPath The path to xcrun
 */
export async function checkSimulator(
  xcrunPath: string,
  device?: string
): Promise<string> {
  const { execa } = await import('execa');
  // get the list of simulators
  const response = await execa(xcrunPath, ['simctl', 'list', 'devices']);
  const stdout = response.stdout as string;

  const devices = stdout
    .split('\n')
    .filter((line) => line.includes('(Booted)'))
    .map((line) => line.replace(/.+\(([A-F0-9\-]+)\).+/, '$1'));

  // not enough devices?
  if (devices.length === 0) {
    throw createError(ErrorCode.NoRunningiOSSimulators);
  }

  // only 1 and no preference?  just pick that.
  if (devices.length === 1 && !device) {
    return devices[0];
  }

  // too many devices?
  if (devices.length > 1 && !device) {
    throw createError(ErrorCode.AmbiguousiOSSimulator);
  }

  // can't find what the user is looking for?
  if (device && devices.indexOf(device) < 0) {
    throw createError(ErrorCode.MissingiOSSimulator);
  }

  return device || 'booted';
}

/**
 * Takes a screenshot of the current running simulator and saves it to a file.
 *
 * @param xcrunPath The path to xcrun
 * @param filename The filename to save
 */
export async function saveScreenshot(
  xcrunPath: string,
  device: string,
  filename: string
) {
  try {
    const { execa } = await import('execa');
    await execa(xcrunPath, ['simctl', 'io', device, 'screenshot', filename]);
  } catch (err) {
    throw createError(ErrorCode.ScreenshotFail);
  }
}

/**
 * Runs the iOS snapshot.
 *
 * @param parameters The CLI parameters
 */
export async function saveToFile(parameters: CliParameters) {
  const xcrun = await getXcrunPath();
  const device = await checkSimulator(xcrun, parameters.device);
  await saveScreenshot(xcrun, device, parameters.filename);
}
