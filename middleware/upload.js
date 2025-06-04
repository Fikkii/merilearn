const multer = require('multer');
const path = require('path');
const fs = require('fs');

function useUploader(folder = '/uploads') {
  // Define the absolute upload directory
  const UPLOAD_DIR = path.join(process.cwd(), folder);

  // Ensure the upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Setup multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    }
  });

  const upload = multer({ storage });

  // Return middleware function
  return (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return next(err);

      if (req.file) {
        // Generate full URL
        const relativePath = path.join(folder, req.file.filename).replace(/\\/g, '/');
        const fileUrl = `${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;

        req.file.uploadUrl = fileUrl; // Attach full URL to request
      }

      next();
    });
  };
}

module.exports = { useUploader };

