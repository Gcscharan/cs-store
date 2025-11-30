const fs = require('fs');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

(async () => {
  try {
    const path = require('path').join(require('os').homedir(), 'Desktop', 'photo.jpg');
    const buf = fs.readFileSync(path);
    console.log('Local file size bytes:', buf.length);

    const res = await cloudinary.uploader.upload_stream({ folder: 'debug-test' }, (error, result) => {
      if (error) {
        console.error('Cloudinary error (callback):', error);
        process.exit(1);
      }
      console.log('Cloudinary result:', result);
      process.exit(0);
    }).end(buf);
  } catch (err) {
    console.error('Standalone upload error:', err);
    process.exit(1);
  }
})();
