// 1. IMPORT v2 EXPLICITLY
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const dotenv = require("dotenv");

// Ensure this path is correct based on where you run 'npm start'
dotenv.config({ path: "./.env" });

// 3. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // FIXED TYPO (Removed 'E')
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 1) Set up the imageStorage
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req) => `hotel/${req.params.id}`,
    allowed_formats: ["jpeg", "jpg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

// photo upload
const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image")) {
      return cb(new Error("only image allowed"), false);
    }
    cb(null, true);
  },
});

// 4. Configure Storage
// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: "test_folder",
//     allowed_formats: ["jpg", "png", "jpeg"],
//   },
// });

module.exports = { uploadImage, cloudinary };
