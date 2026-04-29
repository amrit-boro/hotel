const catchAsync = require("../utils/catchAsync");
const MenuItem = require("../models/menuItem");
const mongoose = require("mongoose"); // Import mongoose for ID validation
const menuPermission = require("../utils/checkMenuPermision");
const Hotel = require("../models/hotel");
const HotelStaff = require("../models/hotelStuff");
const AppError = require("../utils/appError");
const { cloudinary } = require("../utils/cloudinary");
const APIFeatures = require("../utils/apiFeatures");

const determineHotelId = async (user, providedId) => {
  // 1. If ID is provided explicitly, use it (The safe way) which is hotelId
  if (providedId) return providedId;

  // 2. If NO ID provided, try to find it automatically
  // A. Check if they are an OWNER of any hotel
  const ownedHotels = await Hotel.find({ ownerId: user._id.toString() });
  console.log("OwnedHote:", ownedHotels);

  // B. Check if they are STAFF at any hotel
  const staffRecords = await HotelStaff.find({ userId: user._id.toString() });

  // 4. COMBINE THEM INTO A LIST OF UNIQUE IDs
  // We use a Set to automatically remove duplicates
  const distinctHotelIds = new Set();

  ownedHotels.forEach((h) => distinctHotelIds.add(h._id.toString()));
  staffRecords.forEach((s) => distinctHotelIds.add(s.hotelId.toString()));

  const uniqueCount = distinctHotelIds.size;

  // SCENARIO 1: New user or no hotels
  if (uniqueCount === 0) {
    throw new AppError("You are not linked to any hotel.", 400);
  }

  // SCENARIO 2: Single Hotel (The "Auto-Detect" Magic ✨)
  if (uniqueCount === 1) {
    if (ownedHotels.length === 1) return ownedHotels[0]._id;
    if (staffRecords.length === 1) return staffRecords[0].hotelId;
  }

  // SCENARIO 3: Multiple Hotels (Ambiguity 🛑)
  if (uniqueCount > 1) {
    throw new AppError(
      "You manage multiple hotels. Please specify 'hotelId'.",
      400,
    );
  }
};

// ======================================================
// 🟢 PUBLIC ROUTE: Get Menu (For QR App)
// ======================================================
// exports.allItem = catchAsync(async (req, res, next) => {
//   const {
//     category,
//     hotelId,
//     veg,
//     search,
//     sort = "-createdAt",
//     page = 1,
//     limit = 10,
//   } = req.query;

//   // 1. Build filter object dynamically
//   const filter = {};

//   if (category) {
//     filter.category = { $regex: `^${category}$`, $options: "i" };
//   }

//   if (hotelId) {
//     filter.hotelId = hotelId;
//   }

//   if (veg !== undefined) {
//     filter.veg = veg === "true";
//   }
//   // Always filter available items
//   filter.isAvailable = true;
//   // 2. Search (on name + description)
//   if (search) {
//     filter.$or = [
//       { name: { $regex: search, $options: "i" } },
//       { description: { $regex: search, $options: "i" } },
//     ];
//   }
//   // 3. Pagination
//   const skip = (page - 1) * limit;
//   const items = await MenuItem.find(filter)
//     .sort(sort)
//     .skip(skip)
//     .limit(Number(limit));

//   res.status(200).json({
//     status: "success",
//     results: items.length,
//     page: Number(page),
//     data: {
//       items,
//     },
//   });
// });

exports.allItem = catchAsync(async (req, res, next) => {
  // Set reasonable limits for production
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  req.query.limit = limit;

  const features = new APIFeatures(
    MenuItem.find({ isAvailable: true }).lean(), // Use lean() for better performance
    req.query,
  )
    .filter()
    .search()
    .sort()
    .limitFields()
    .paginate();

  let items = await features.query;

  // Filter out unavailable choices from each menu item
  if (items && items.length > 0) {
    items = items.map((item) => {
      // Skip if no options
      if (
        !item.options ||
        !Array.isArray(item.options) ||
        item.options.length === 0
      ) {
        return item;
      }

      // Process each option and filter choices
      const filteredOptions = [];

      for (const option of item.options) {
        // Filter available choices
        const availableChoices = option.choices.filter(
          (choice) => choice.isAvailable === true,
        );

        // Only keep options that have at least one available choice
        if (availableChoices.length > 0) {
          filteredOptions.push({
            ...option,
            choices: availableChoices,
          });
        }
      }

      item.options = filteredOptions;
      return item;
    });
  }

  res.status(200).json({
    status: "success",
    results: items.length,
    data: {
      items,
    },
  });
});

exports.getItem = catchAsync(async (req, res, next) => {
  const { itemId: id } = req.params;

  console.log("id: ", id);

  // 🔒 SECURITY CHECK 1: Is this a valid MongoDB ID?
  // If we don't check this, Mongoose will throw a 'CastError' and crash the request.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid Item ID format detected.",
    });
  }

  // 🔍 QUERY: Find the specific item
  const item = await MenuItem.findById(id);

  // 🔒 SECURITY CHECK 2: Does the item actually exist?
  if (!item) {
    return res.status(404).json({
      status: "fail",
      message: "Item not found. It may have been removed.",
    });
  }

  // ✅ SUCCESS
  res.status(200).json({
    status: "success",
    data: item,
  });
});

exports.hotelMenu = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  console.log("hotelId: ", hotelId);
  // Fetch only available items, sorted by category
  const menu = await MenuItem.find({ hotelId, isAvailable: true }).sort(
    "category",
  );

  if (!menu) {
    return next(new AppError("No menu found for this hotel", 404));
  }

  res.status(200).json({
    success: true,
    results: menu.length,
    data: menu,
  });
});

// CREATE MENU =============

exports.createMenu = catchAsync(async (req, res, next) => {
  const {
    hotelId,
    name,
    category,
    description,
    veg,
    price,
    image,
    options,
    isAvailable,
  } = req.body;

  // 1. Validate required fields
  if (!hotelId || !name || !category || price === undefined) {
    return next(new AppError("Missing required fields", 400));
  }

  // 2. Validate objectsId
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotelId", 400));
  }

  //3. Normalize options (for consistency)
  let normalizedOptions = [];
  if (Array.isArray(options)) {
    normalizedOptions = options.map((opt) => ({
      name: opt.name?.trim(),
      required: Boolean(opt.required),
      choices: Array.isArray(opt.choices)
        ? opt.choices.map((choice) => ({
            name: choice.name?.trim(),
            priceMod: Number(choice.priceMod) || 0,
          }))
        : [],
    }));
  }

  // 4. Create menu item
  const menuItem = await MenuItem.create({
    hotelId,
    name: name.trim(),
    category: category.trim(),
    description: description?.trim() || "",
    veg: veg !== undefined ? veg : true, // if veg is not undefind use that veg otherwise true
    price: Number(price),
    image: {
      url: image?.url || "",
      publicId: image?.publicId || "",
    },
    isAvailable: isAvailable !== undefined ? isAvailable : true,
    options: normalizedOptions,
  });

  // 5. Response
  res.status(201).json({
    status: "Success",
    data: {
      menuItem,
    },
  });
});

exports.addMenu = catchAsync(async (req, res, next) => {
  let { hotelId, name, price, category, options, description } = req.body;

  // 1. Auto-Detect Hotel ID
  try {
    hotelId = await determineHotelId(req.user, hotelId);
  } catch (err) {
    return next(err);
  }

  // 2. Permission Check
  const isAllowed = await menuPermission.checkMenuPermission(
    req.user._id.toString(),
    hotelId,
  );
  if (!isAllowed)
    return next(new AppError("Access Denied. You cannot edit this menu.", 403));

  // 3. Handle Image Object (Option 2 Logic)
  let imageData = null;
  if (req.file) {
    imageData = {
      url: req.file.path, // Viewable Link
      publicId: req.file.filename, // Delete Key
    };
  }

  // 4. Handle Options Parsing
  if (options && typeof options === "string") {
    try {
      options = JSON.parse(options);
    } catch (e) {
      return next(new AppError("Invalid JSON format for options.", 400));
    }
  }

  const newItem = await MenuItem.create({
    hotelId,
    name,
    price,
    category,
    options,
    description,
    image: imageData, // <--- Saving the Object { url, publicId }
    isAvailable: true,
  });

  res.status(201).json({ success: true, data: newItem });
});

// UPDATE MENU =============

// exports.updateMenu = catchAsync(async (req, res, next) => {
//   const itemId = req.params.id;

//   // 1. Find Existing Item
//   const item = await MenuItem.findById(itemId);
//   if (!item) return next(new AppError("Item Not found", 404));

//   // 2. Permission Check
//   const isAllowed = await menuPermission.checkMenuPermission(
//     req.user._id.toString(),
//     item.hotelId.toString(),
//   );
//   if (!isAllowed) return next(new AppError("Access Denied.", 403));

//   // --- START OF UPDATE LOGIC ---
//   const mongooseUpdate = {};

//   // A. Handle Image Upload & Cleanup 🗑️
//   if (req.file) {
//     if (item.image && item.image.publicId) {
//       // Don't wait for this (fire and forget) to speed up response
//       cloudinary.uploader
//         .destroy(item.image.publicId)
//         .catch((err) => console.error("Cloudinary Del Error:", err));
//     }

//     mongooseUpdate.image = {
//       url: req.file.path,
//       publicId: req.file.filename,
//     };
//   }

//   // B. Handle Top-Level Fields
//   // ⚠️ FORM-DATA GOTCHA: Everything comes as a String!
//   if (req.body.name) mongooseUpdate.name = req.body.name;
//   if (req.body.description) mongooseUpdate.description = req.body.description;
//   if (req.body.category) mongooseUpdate.category = req.body.category;

//   if (req.body.price) {
//     mongooseUpdate.price = Number(req.body.price); // Force Number
//   }

//   // Handle Boolean (Form-data sends "true"/"false" strings)
//   if (req.body.isAvailable !== undefined) {
//     mongooseUpdate.isAvailable =
//       req.body.isAvailable === "true" || req.body.isAvailable === true;
//   }

//   // C. THE TARGETED OPTION UPDATE 🎯
//   // (Great for changing just one option's price without re-sending the whole array)
//   if (req.body.specificOptionUpdate) {
//     try {
//       const instruction = JSON.parse(req.body.specificOptionUpdate);
//       const index = instruction.index;
//       const data = instruction.data;

//       if (typeof index !== "number") throw new Error("Index missing");

//       // Safety: Ensure we aren't updating an index that doesn't exist
//       if (!item.options || index >= item.options.length) {
//         return next(new AppError("Option index out of bounds", 400));
//       }

//       Object.keys(data).forEach((key) => {
//         // e.g., "options.0.priceMod"
//         mongooseUpdate[`options.${index}.${key}`] = data[key];
//       });
//     } catch (e) {
//       return next(new AppError("Invalid specificOptionUpdate format.", 400));
//     }
//   }
//   // D. Fallback: Full Array Replace 🔄
//   else if (req.body.options) {
//     const opts =
//       typeof req.body.options === "string"
//         ? JSON.parse(req.body.options)
//         : req.body.options;

//     mongooseUpdate.options = opts;
//   }

//   // 3. Perform the Update
//   const updatedItem = await MenuItem.findByIdAndUpdate(
//     itemId,
//     { $set: mongooseUpdate },
//     { new: true, runValidators: true },
//   );

//   res.status(200).json({ success: true, data: updatedItem });
// });

const processOptionsUpdata = (options) => {
  if (!options || !Array.isArray(options)) return options;

  return options.map((option) => ({
    ...option,
    choices:
      option.choices?.map((choice) => ({
        ...choice,
        // Preserve isAvailable if provided, don't set default
        isAvailable:
          choice.isAvailable !== undefined
            ? choice.isAvailable
            : choice.isAvailable,
      })) || [],
  }));
};

exports.updateMenu = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Ivalid menu item ID", 400));
  }

  // Process options if present in update
  if (updateData.options) {
    updateData.options = processOptionsUpdata(updateData.options);
  }

  // Remove fields that shouldn't be updated directly
  const prohibitedUpdates = ["_id", "__v", "createdAt", "ratings"];
  prohibitedUpdates.forEach((field) => delete updateData[field]);

  // Find and update with validation
  const updatedItem = await MenuItem.findByIdAndUpdate(id, updateData, {
    new: true, // Return updated document
    runValidators: true, // Run schema validators
    context: "query", // Required for unique validators
  });

  if (!updatedItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      item: updatedItem,
    },
  });
});

// Update specific choice availability (most common use case)
exports.updateChoiceAvailability = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { optionIndex, choiceIndex, isAvailable } = req.body;

  // Validate inputs
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  if (optionIndex === undefined || choiceIndex === undefined) {
    return next(
      new AppError("Option index and choice index are required", 400),
    );
  }

  if (typeof isAvailable !== "boolean") {
    return next(new AppError("isAvailable must be a boolean", 400));
  }

  // Create update path dynamically
  const updatePath = `options.${optionIndex}.choices.${choiceIndex}.isAvailable`;

  const updatedItem = await MenuItem.findByIdAndUpdate(
    id,
    { [updatePath]: isAvailable },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  // Verify the choice exists
  if (!updatedItem.options[optionIndex]?.choices[choiceIndex]) {
    return next(new AppError("Option or choice not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: `Choice availability updated to ${isAvailable}`,
    data: {
      item: updatedItem,
      updatedChoice: {
        option: updatedItem.options[optionIndex].name,
        choice: updatedItem.options[optionIndex].choices[choiceIndex].name,
        isAvailable:
          updatedItem.options[optionIndex].choices[choiceIndex].isAvailable,
      },
    },
  });
});

// 3) DELETE ITEM-----------------------------------
exports.deleteMenu = catchAsync(async (req, res, next) => {
  const itemId = req.params.id;

  // 1. Find Item
  const item = await MenuItem.findById(itemId);
  if (!item) return next(new AppError("Item Not found", 404));

  // 2. Permission Check
  const isAllowed = await menuPermission.checkMenuPermission(
    req.user._id.toString(),
    item.hotelId.toString(),
  );
  if (!isAllowed) return next(new AppError("Access Denied.", 403));

  // 3. DELETE IMAGE FROM CLOUD (Option 2 Logic)
  // We have the exact Public ID, so this is 100% safe.
  if (item.image && item.image.publicId) {
    await cloudinary.uploader.destroy(item.image.publicId);
  }

  // 4. DELETE FROM DB
  await MenuItem.findByIdAndDelete(itemId);

  res.status(200).json({ success: true, msg: "Item and Image deleted." });
});
