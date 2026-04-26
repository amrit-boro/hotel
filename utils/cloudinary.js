// 1. IMPORT v2 EXPLICITLY
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const dotenv = require("dotenv");

// Ensure this path is correct based on where you run 'npm start'
dotenv.config({ path: "./.env" });

// 2. DEBUG: Check if keys are loading (Remove this later)
console.log("Cloud Name from Env:", process.env.CLOUDINARY_CLOUD_NAME);

// 3. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // FIXED TYPO (Removed 'E')
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 4. Configure Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "test_folder",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const parser = multer({ storage: storage });

module.exports = { parser, cloudinary };
