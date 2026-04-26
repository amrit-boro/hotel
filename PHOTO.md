For your specific setup (Node.js + React Native/Web), **Cloudinary** is the best choice, effectively beating AWS S3 or Local Storage for an MVP.

### Why Cloudinary?

1.  **Speed (The "Mobile" Problem):** A user might upload a 5MB high-res photo of a burger. If you serve that huge file to a customer on 4G, your menu will load slowly. Cloudinary **automatically resizes and compresses** it (e.g., turns it into a tiny 50KB WebP file) without you writing complex code.
2.  **Deployment Safety:** Since you will likely host your Node.js backend on platforms like Render, Heroku, or Vercel, you **cannot** save files locally (local files get deleted every time the server restarts). You need external cloud storage.
3.  **Free Tier:** Their free tier is very generous for a startup.

---

### The Architecture

We don't save the image in MongoDB. We save the **URL**.

1.  **Frontend:** Sends the file to your API.
2.  **Middleware (Multer):** Catches the file in RAM.
3.  **Cloudinary:** Uploads it, optimizes it, and gives back a URL (e.g., `https://res.cloudinary.com/.../burger.jpg`).
4.  **MongoDB:** You save that URL string in the `MenuItem` document.

---

### Step 1: Install Dependencies

Run this in your backend folder:

```bash
npm install cloudinary multer multer-storage-cloudinary dotenv
```

### Step 2: Configure Cloudinary (`utils/cloudinary.js`)

Go to Cloudinary.com, sign up, and get your Cloud Name, API Key, and Secret. Put them in your `.env` file.

Create this utility file to configure the storage engine.

```javascript
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "quickorder_menu_items", // The folder name in your Cloudinary dashboard
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 500, height: 500, crop: "limit" }], // Resize to max 500px to save data
  },
});

const parser = multer({ storage: storage });

module.exports = parser;
```

### Step 3: Update Menu Route (`routes/menu.js`)

We need to inject the `parser.single('image')` middleware into your route. This middleware intercepts the file **before** your controller runs.

**Updated Route Code:**

```javascript
const upload = require("../utils/cloudinary"); // Import the file we just made

// POST /api/menu/add
// Note: 'image' is the name of the form-data field coming from Frontend
router.post(
  "/add",
  authMiddleware,
  upload.single("image"),
  catchAsync(async (req, res, next) => {
    // 1. Get Text Data
    let { hotelId, name, price, category, options, description } = req.body;

    // 2. Auto-detect Hotel ID (The helper we wrote earlier)
    try {
      hotelId = await determineHotelId(req.user, hotelId);
    } catch (err) {
      return next(err);
    }

    // 3. Check Permissions
    const isAllowed = await checkMenuPermission(req.user._id, hotelId);
    if (!isAllowed) return next(new AppError("Access Denied.", 403));

    // 4. GET THE IMAGE URL (The Magic Part ✨)
    // Multer + Cloudinary puts the file info into req.file
    let imageUrl = "";
    if (req.file) {
      imageUrl = req.file.path; // This is the Cloudinary URL (https://...)
    }

    // 5. Create Item
    // Note: If 'options' comes as a string (because of FormData), parse it
    if (typeof options === "string") {
      options = JSON.parse(options);
    }

    const newItem = await MenuItem.create({
      hotelId,
      name,
      price,
      category,
      options,
      description,
      imageUrl, // Save the URL to DB
      isAvailable: true,
    });

    res.status(201).json({
      success: true,
      data: newItem,
    });
  })
);
```

### Step 4: How to Test in Postman

Because you are uploading a file, you **cannot** use "Raw JSON" in Postman anymore. You must use **Form-Data**.

1.  **Body Tab:** Select **form-data**.
2.  **Key:** `name` -\> **Value:** "Cheese Burger"
3.  **Key:** `price` -\> **Value:** 150
4.  **Key:** `image` -\> **Change Dropdown from Text to File** -\> Select a `jpg` from your computer.
5.  **Key:** `options` -\> **Value:** (You must paste the JSON string here)
    `[{"name":"Spicy","choices":[{"name":"Yes","priceMod":0}]}]`

### Important Note on Frontend

When you build the React Native or React Web form later, you must create a `FormData` object instead of a standard JSON object:

```javascript
const formData = new FormData();
formData.append("name", "Burger");
formData.append("price", "150");
formData.append("image", fileInput.files[0]); // The actual file
formData.append("options", JSON.stringify(optionsArray)); // Must stringify arrays for FormData

axios.post("/api/menu/add", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

Are you ready to set up **Socket.IO** now to handle the real-time ordering?
