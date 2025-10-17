// import { google } from "googleapis";
// import "dotenv/config";

// async function testAccess() {
//   const auth = new google.auth.GoogleAuth({
//     credentials: {
//       type: "service_account",
//       project_id: process.env.GOOGLE_PROJECT_ID,
//       private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//       client_email: process.env.GOOGLE_CLIENT_EMAIL,
//     },
//     scopes: ["https://www.googleapis.com/auth/drive.readonly"],
//   });

//   const drive = google.drive({ version: "v3", auth });

//   const res = await drive.files.list({
//     q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
//     fields: "files(id, name)",
//   });

//   console.log("Files visible to service account:", res.data.files);
// }

// testAccess();

import { google } from "googleapis";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob" // desktop apps
);

// Generate consent URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline", // important to get refresh token
  scope: ["https://www.googleapis.com/auth/drive.file"], // allows uploading files
});

console.log("Visit this URL in your browser:", authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter the code from Google: ", async (code) => {
  const { tokens } = await oAuth2Client.getToken(code);
  console.log("Here is your refresh token:", tokens.refresh_token);
  rl.close();
});