import { readFileSync } from 'fs';

const version = JSON.parse(
  readFileSync(`${__dirname}/../package.json`).toString()
).version;

export const usage = `📸  OSNAP ${version}

   Screenshot your iOS/Android sim and save to a file or on your clipboard.

✍️  USAGE

   osnap [ios|android] [-f filename.png] [-d device_id]

🍎  EXAMPLE :: iOS

   osnap ios
   osnap ios -f sweet.png
   osnap ios -f sweet.png -d 6371666E-28B2-49A6-9026-C9944AA616DF

🤖  EXAMPLE :: Android

   osnap android
   osnap android -f cool.png
   osnap android -f omg.png -d emulator-5554

💃  ABOUT

   https://github.com/skellock/osnap
`;
