/**
 * Upload a local file to Google Drive using a Service Account, make it public,
 * then update Firebase Realtime Database /posts/<postId>/videoUrl with a direct download URL.
 *
 * Usage:
 *   npm install googleapis firebase-admin
 *   node scripts/upload_to_drive_and_update_db.js \
 *     --serviceAccount=./serviceAccountKey.json \
 *     --local=./path/to/video.mp4 \
 *     --postId=quiz_1 \
 *     --databaseUrl=https://tiktok-f72e6-default-rtdb.firebaseio.com
 *
 * Notes:
 * - Service account will upload into its own Drive. To upload into a specific Drive folder,
 *   pass --folderId=FOLDER_ID where the service account has access.
 * - The script makes the file readable by anyone with the link (permission type: anyone).
 * - The returned URL used for playback is: https://drive.google.com/uc?export=download&id=FILE_ID
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const admin = require('firebase-admin');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const [k, v] = a.split('=');
    const key = k.replace(/^--/, '');
    args[key] = v || true;
  });
  return args;
}

async function main() {
  const args = parseArgs();
  const required = ['serviceAccount', 'local', 'postId', 'databaseUrl'];
  for (const r of required) {
    if (!args[r]) {
      console.error('Missing --' + r);
      process.exit(2);
    }
  }

  const svcPath = path.resolve(args.serviceAccount);
  if (!fs.existsSync(svcPath)) {
    console.error('Service account file not found:', svcPath);
    process.exit(2);
  }

  const serviceAccount = require(svcPath);

  // Init Firebase Admin (for updating Realtime DB)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: args.databaseUrl,
  });

  // Drive auth using JWT client for service accounts
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/drive']
  );

  await jwtClient.authorize();
  const drive = google.drive({ version: 'v3', auth: jwtClient });

  const localPath = path.resolve(args.local);
  if (!fs.existsSync(localPath)) {
    console.error('Local file not found:', localPath);
    process.exit(2);
  }

  const fileName = args.name || path.basename(localPath);
  const media = {
    mimeType: 'video/mp4',
    body: fs.createReadStream(localPath),
  };

  const resource = {
    name: fileName,
    parents: args.folderId ? [args.folderId] : undefined,
  };

  console.log('Uploading', localPath, 'to Google Drive...');
  const res = await drive.files.create({
    requestBody: resource,
    media,
    fields: 'id, name'
  });

  const fileId = res.data.id;
  if (!fileId) {
    throw new Error('No file ID returned from Drive');
  }

  console.log('Uploaded file id:', fileId);

  // Make the file readable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  console.log('Public download URL:', downloadUrl);

  // Update Realtime DB
  const dbRef = admin.database().ref(`/posts/${args.postId}`);
  await dbRef.update({ videoUrl: downloadUrl });
  console.log('Realtime DB updated at /posts/' + args.postId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
