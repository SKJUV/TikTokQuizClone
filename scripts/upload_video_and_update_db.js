/*
Usage:
  1) Install deps:
     npm install firebase-admin
  2) Run:
     node scripts/upload_video_and_update_db.js \
       --serviceAccount=./serviceAccountKey.json \
       --bucket=your-bucket.appspot.com \
       --databaseUrl=https://tiktok-f72e6-default-rtdb.firebaseio.com \
       --local=./path/to/video.mp4 \
       --dest=videos/video.mp4 \
       --postId=quiz_1

This uploads the file to Firebase Storage, creates a signed read URL (7 days),
and updates the Realtime Database at /posts/<postId>/videoUrl with that URL.
Requires a Service Account JSON with Storage & Database permissions.
*/

const fs = require('fs');
const path = require('path');
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
  const required = ['serviceAccount', 'bucket', 'databaseUrl', 'local', 'dest', 'postId'];
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

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: args.bucket,
    databaseURL: args.databaseUrl,
  });

  const bucket = admin.storage().bucket();
  const localPath = path.resolve(args.local);
  const destPath = args.dest;

  console.log('Uploading', localPath, 'to', args.bucket + '/' + destPath);
  await bucket.upload(localPath, {
    destination: destPath,
    metadata: {
      contentType: 'video/mp4',
    },
  });

  const file = bucket.file(destPath);
  // generate signed URL valid 7 days
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const [signedUrl] = await file.getSignedUrl({ action: 'read', expires });

  console.log('Signed URL:', signedUrl);

  // update database
  const dbRef = admin.database().ref(`/posts/${args.postId}`);
  await dbRef.update({ videoUrl: signedUrl });

  console.log('Realtime DB updated at /posts/' + args.postId);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
