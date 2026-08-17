import { ErrorCode, createError } from './errors.js'
import { resolve } from 'path'
import { execa } from 'execa'

// TODO: support other platforms other than mac
const pathToCopyApp = resolve(`${import.meta.dirname}/../macos/pbcopyimg`)

export async function copyToClipboard(imagePath: string) {
  // verify the platform
  if (process.platform !== 'darwin') {
    throw createError(ErrorCode.ClipboardPlatformUnsupported)
  }

  // run the command to copy to the clipboard
  try {
    await execa(pathToCopyApp, [imagePath])
  } catch (err) {
    // was there a horrible issue?
    throw createError(ErrorCode.CopyToClipboardFail)
  }

  return true
}
