import { parse } from './cli-parameters.js';
import { type OsnapError, ErrorCode } from './errors.js';
import { usage } from './cli-usage.js';
import { saveToFile as iosSave } from './ios.js';
import { saveToFile as androidSave } from './android.js';
import { copyToClipboard } from './copy-to-clipboard.js';

/**
 * Runs the CLI and returns the exit code we should use.
 */
export async function run() {
  try {
    const parameters = parse();

    // save it to a file
    if (parameters.platform === 'ios') {
      await iosSave(parameters);
    } else if (parameters.platform === 'android') {
      await androidSave(parameters);
    }

    // copy it to the clipboard
    if (parameters.useClipboard) {
      await copyToClipboard(parameters.filename);
    }

    return 0;
  } catch (err) {
    // typescript doesn't support typing the catch parameter
    if ((err as OsnapError).code === ErrorCode.MissingPlatform) {
      // print usage instead
      console.log(usage);
      return 0;
    } else {
      console.error((err as Error).message);
      return 1;
    }
  }
}
