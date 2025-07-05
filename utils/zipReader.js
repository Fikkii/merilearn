const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

// Create auth client with service account
const auth = new GoogleAuth({
  keyFile: 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

/**
 * Extracts text files from a ZIP archive downloaded from Google Drive,
 * ignoring images, and returns a single concatenated string for grading.
 *
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<string>} Concatenated project content
 */
async function extractAndConcatZip(fileId) {
  // Get access token
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;

  // Download file as arraybuffer (Buffer)
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    }
  );

  const zipBuffer = Buffer.from(response.data);
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const excludeExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
  let result = '';

  entries.forEach(entry => {
    if (entry.isDirectory) return;

    const ext = path.extname(entry.entryName).toLowerCase();

    if (!excludeExtensions.includes(ext)) {
      const content = entry.getData().toString('utf8');
      // Add separator so Gemini understands different files
      result += `\n\n--- FILE: ${entry.entryName} ---\n\n${content}\n`;
    }
  });

  return result;
}

module.exports = { extractAndConcatZip };

