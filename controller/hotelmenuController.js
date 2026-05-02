const catchAsync = require("../utils/catchAsync");
const MenuItem = require("../models/menuItem");
const mongoose = require("mongoose"); // Import mongoose for ID validation
const menuPermission = require("../utils/checkMenuPermision");
const Hotel = require("../models/hotel");
const HotelStaff = require("../models/hotelStuff");
const AppError = require("../utils/appError");
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
//  Get Menu (For QR App)
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
  // Exclude soft deleted items by default
  const query = {
    isAvailable: true,
    softDeleted: { $ne: true }, // Don't show soft deleted items
  };

  const features = new APIFeatures(MenuItem.find(query).lean(), req.query)
    .filter()
    .search()
    .sort()
    .limitFields()
    .paginate();

  let items = await features.query;

  // Filter out unavailable choices
  if (items && items.length > 0) {
    items = items.map((item) => {
      if (!Array.isArray(item.options) || item.options.length === 0) {
        return item;
      }

      const filteredOptions = item.options
        // 1. Remove soft-deleted options
        .filter((option) => option.isAvailable !== false)
        .map((option) => {
          // 2. Filter choices (treat undefined as available)
          const availableChoices =
            option.choices?.filter((choice) => choice.isAvailable !== false) ||
            [];

          return {
            ...option,
            choices: availableChoices,
          };
        })
        // 3. Remove options with no choices left
        .filter((option) => option.choices.length > 0);

      return {
        ...item,
        options: filteredOptions,
      };
    });
  }
  res.status(200).json({
    status: "success",
    results: items.length,
    data: { items },
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

// ==========================================================
// CREATE MENU
// ==========================================================
exports.createMenu = catchAsync(async (req, res, next) => {
  const { name, category, description, veg, price, isAvailable } = req.body;

  let { options } = req.body;
  const hotelId = req.user?.hotelId;
  // 1. Validate required fields
  if (!hotelId || !name || !category || price === undefined) {
    return next(new AppError("Missing required fields", 400));
  }

  // 2. Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotelId", 400));
  }

  // 3. Parse options (because form-data sends string)
  let parsedOptions = [];
  if (options) {
    try {
      parsedOptions =
        typeof options === "string" ? JSON.parse(options) : options;
    } catch (err) {
      return next(new AppError("Invalid options JSON format", 400));
    }
  }

  // 4. Normalize options
  const normalizedOptions = Array.isArray(parsedOptions)
    ? parsedOptions.map((opt) => ({
        name: opt.name?.trim(),
        required: Boolean(opt.required),
        choices: Array.isArray(opt.choices)
          ? opt.choices.map((choice) => ({
              name: choice.name?.trim(),
              priceMod: Number(choice.priceMod) || 0,
              isAvailable:
                choice.isAvailable !== undefined
                  ? Boolean(choice.isAvailable)
                  : true,
            }))
          : [],
      }))
    : [];

  // 5. Extract image (already uploaded to :contentReference[oaicite:0]{index=0})
  const imageData = req.file
    ? {
        url: req.file.path,
        publicId: req.file.filename,
      }
    : {
        url: "",
        publicId: "",
      };

  // 6. Create menu item
  const menuItem = await MenuItem.create({
    hotelId,
    name: name.trim(),
    category: category.trim(),
    description: description?.trim() || "",
    veg: veg !== undefined ? veg === "true" || veg === true : true,
    price: Number(price),
    image: imageData,
    isAvailable:
      isAvailable !== undefined
        ? isAvailable === "true" || isAvailable === true
        : true,
    options: normalizedOptions,
  });

  // 7. Response
  res.status(201).json({
    status: "success",
    data: { menuItem },
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

// =============================================================
// UPDATE MENU
// =============================================================

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

// Bulk update multiple choices availability
exports.bulkUpdateChoicesAvailability = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { updates } = req.body; // Array of { optionIndex, choiceIndex, isAvailable }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return next(new AppError("Updates array is required", 400));
  }

  const menuItem = await MenuItem.findById(id);
  if (!menuItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  // Apply all updates
  for (const update of updates) {
    const { optionIndex, choiceIndex, isAvailable } = update;

    if (menuItem.options[optionIndex]?.choices[choiceIndex]) {
      menuItem.options[optionIndex].choices[choiceIndex].isAvailable =
        isAvailable;
    }
  }

  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: `Updated ${updates.length} choice(s)`,
    data: {
      item: menuItem,
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

// Add new option to existing menu item
exports.addOption = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, required, choices } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  if (!name || !choices || !Array.isArray(choices)) {
    return next(
      new AppError("Option name and choices array are required", 400),
    );
  }

  // Check Menu
  const menuItem = await MenuItem.findById(id);
  if (!menuItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  const processedChoices = choices.map((choice) => ({
    name: choice.name,
    priceMod: choice.priceMod,
    isAvailable: choice.isAvailable !== undefined ? choice.isAvailable : true,
  }));

  // Push to menu
  menuItem.options.push({
    name,
    required: required || false,
    choices: processedChoices,
  });

  await menuItem.save();

  res.status(201).json({
    status: "success",
    data: {
      item: menuItem,
    },
  });
});

// Remove Option
exports.removeOption = catchAsync(async (req, res, next) => {
  const { id, optionIndex } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  const menuItem = await MenuItem.findById(id);
  if (!menuItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  if (!menuItem.options[optionIndex]) {
    return next(new AppError("Option not found", 404));
  }

  menuItem.options.splice(optionIndex, 1);
  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: "Option removed successfully",
    data: {
      item: menuItem,
    },
  });
});

// Update specific option
exports.updateOption = catchAsync(async (req, res, next) => {
  const { id, optionIndex } = req.params;
  const { name, required, choices } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  const menuItem = await MenuItem.findById(id);
  if (!menuItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  if (!menuItem.options[optionIndex]) {
    return next(new AppError("Option not found", 404));
  }

  // Update option fields
  if (name) menuItem.options[optionIndex].name = name;
  if (required !== undefined) menuItem.options[optionIndex].required = required;

  // Update choices if provided
  if (choices && Array.isArray(choices)) {
    menuItem.options[optionIndex].choices = choices.map((choice) => ({
      name: choice.name,
      priceMod: choice.priceMod || 0,
      isAvailable: choice.isAvailable !== undefined ? choice.isAvailable : true,
    }));
  }

  await menuItem.save();

  res.status(200).json({
    status: "success",
    data: {
      item: menuItem,
    },
  });
});

// ====================================================================
//  DELETE ITEM
// ====================================================================

// 1. Hard Delete - Permanently remove from database
exports.deleteMenuItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  // Find and delete permanently
  const deletedItem = await MenuItem.findByIdAndDelete(id);

  if (!deletedItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Menu item permanently deleted",
  });
});

exports.softDeleteMenuItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  // Only mark as unavailable, don't delete
  const updatedItem = await MenuItem.findByIdAndUpdate(
    id,
    {
      isAvailable: false,
      // Optional: Add softDelete flag
      softDeleted: true,
      softDeletedAt: new Date(),
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Menu item has been deactivated (soft deleted)",
    data: {
      item: updatedItem,
    },
  });
});

// 3. Restore Soft Deleted Item
exports.restoreMenuItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item ID", 400));
  }

  // Restore the item
  const restoredItem = await MenuItem.findByIdAndUpdate(
    id,
    {
      isAvailable: true,
      softDeleted: false,
      $unset: { softDeletedAt: "" },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!restoredItem) {
    return next(new AppError("No menu item found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Menu item restored successfully",
    data: {
      item: restoredItem,
    },
  });
});

exports.softDeleteOption = catchAsync(async (req, res, next) => {
  const { id, optionIndex } = req.params;

  // 1. Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item id", 400));
  }

  // 2. Fetch document first (to validate index)
  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    return next(new AppError("Menu item not found", 404));
  }

  // 3. Validate option index
  if (optionIndex < 0 || optionIndex >= menuItem.options.length) {
    return next(new AppError("Invalid option index", 400));
  }

  // 4. Soft delete (mark unavailable)
  menuItem.options[optionIndex].isAvailable = false;

  await menuItem.save();

  res.status(200).json({
    status: "success",
    data: menuItem,
  });
});

exports.restoreSoftDeleteOption = catchAsync(async (req, res, next) => {
  const { id, optionIndex } = req.params;

  // 1. Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item id", 400));
  }

  // 2. Fetch document
  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    return next(new AppError("Menu item not found", 404));
  }

  // 3. Validate option index
  if (optionIndex < 0 || optionIndex >= menuItem.options.length) {
    return next(new AppError("Invalid option index", 400));
  }

  const option = menuItem.options[optionIndex];

  // 4. Check if already active
  if (option.isAvailable === true) {
    return next(new AppError("Option is already active", 400));
  }

  // 5. Restore option
  option.isAvailable = true;

  await menuItem.save();

  res.status(200).json({
    status: "success",
    data: menuItem,
  });
});

// 9. Clean Up Old Soft Deleted Items (Permanently delete after X days)
exports.cleanupSoftDeletedItems = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query; // Default: delete after 30 days

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await MenuItem.deleteMany({
    softDeleted: true,
    softDeletedAt: { $lt: cutoffDate },
  });

  res.status(200).json({
    status: "success",
    message: `Permanently deleted ${result.deletedCount} soft-deleted items older than ${days} days`,
    data: {
      deletedCount: result.deletedCount,
      olderThanDays: days,
    },
  });
});

// ===================

// 8. Delete All Items for a Hotel (Admin only)
exports.deleteAllHotelItems = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotel ID", 400));
  }

  const result = await MenuItem.deleteMany({ hotelId });

  res.status(200).json({
    status: "success",
    message: `Deleted ${result.deletedCount} menu items for hotel ${hotelId}`,
    data: {
      deletedCount: result.deletedCount,
      hotelId,
    },
  });
});

// 9. Clean Up Old Soft Deleted Items (Permanently delete after X days)
exports.cleanupSoftDeletedItems = catchAsync(async (req, res, next) => {
  const { days = 30 } = req.query; // Default: delete after 30 days

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await MenuItem.deleteMany({
    softDeleted: true,
    softDeletedAt: { $lt: cutoffDate },
  });

  res.status(200).json({
    status: "success",
    message: `Permanently deleted ${result.deletedCount} soft-deleted items older than ${days} days`,
    data: {
      deletedCount: result.deletedCount,
      olderThanDays: days,
    },
  });
});
