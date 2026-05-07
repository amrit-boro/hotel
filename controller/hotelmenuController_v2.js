const catchAsync = require("../utils/catchAsync");
const Items = require("../models/item");
const MenuCategory = require("../models/menuCategory");
const MenuItem = require("../models/item");
const mongoose = require("mongoose"); // Import mongoose for ID validation
const AppError = require("../utils/appError");

// Get menu
exports.menuDetails = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;

  // 1) Validate hotelId
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotelId", 400));
  }

  // 2) Fetch categories
  const categories = await MenuCategory.find({
    hotelId,
    isAvailable: true,
    softDeleted: false,
  })
    .select("_id categoryName veg")
    .lean();

  // 3) Fetch items
  const items = await MenuItem.find({
    hotelId,
    isAvailable: true,
    softDeleted: false,
  })
    .select("categoryId name price desc rating itemImg options")
    .lean();

  // 4) Create map + filter options/choices
  const itemsMap = {};

  for (const item of items) {
    const key = item.categoryId.toString();

    // Filter options and choices
    item.options = (item.options || [])
      .filter((opt) => opt.isAvailable)
      .map((opt) => ({
        ...opt,
        choices: (opt.choices || []).filter((choice) => choice.isAvailable),
      }));

    // (Optional) remove option if no choices left
    item.options = item.options.filter((opt) => opt.choices.length > 0);

    // Build map
    if (!itemsMap[key]) {
      itemsMap[key] = [];
    }

    itemsMap[key].push(item);
  }

  // 5) Merge categories with items
  const result = categories.map((cat) => ({
    _id: cat._id,
    name: cat.categoryName,
    veg: cat.veg,
    items: itemsMap[cat._id.toString()] || [],
  }));

  // 6) Send response
  res.status(200).json({
    status: "success",
    results: result.length,
    data: result,
  });
});

// Get categories

exports.getCategoriesViewData = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;

  // 1. Validate hotelId
  if (!hotelId || !mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Please provide a valid hotelId", 400));
  }

  // 2. Fetch categories
  const categoriesRaw = await MenuCategory.find({ hotelId })
    .select("categoryName")
    .lean();

  const counts = await MenuItem.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: "$categoryId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = {};
  counts.forEach((c) => {
    countMap[c._id.toString()] = c.count;
  });

  const categories = categoriesRaw.map((c) => ({
    _id: c._id,
    name: c.categoryName,
    itemCount: countMap[c._id.toString()] || 0,
  }));
  // 5. Send response
  res.status(200).json({
    status: "success",
    results: categories.length,
    data: {
      categories,
    },
  });
});

/**
 * 5) Create a complete menu with multiple items
 */
exports.createCategory = catchAsync(async (req, res, next) => {
  const { hotelId, categoryName, veg, image, isAvailable } = req.body;

  // 1) Validate required fields
  if (!hotelId) {
    return next(new AppError("Hotel ID is required.", 400)); // Fixed typo
  }

  if (!categoryName) {
    return next(new AppError("Category Name is required.", 400));
  }

  // 2) Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotel ID format.", 400)); // Added missing 400 status
  }

  // Clean the input to prevent trailing space bugs
  const cleanName = categoryName.trim();

  // 3) Check for duplicate category name within the same hotel
  const existingCategory = await MenuCategory.findOne({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    softDeleted: false,
    categoryName: {
      $regex: new RegExp(
        `^${cleanName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}$`,
        "i",
      ),
    },
  });

  if (existingCategory) {
    return next(new AppError(`Category '${cleanName}' already exists.`, 400));
  }

  // 4) Construct the payload
  const categoryData = {
    hotelId,
    categoryName: cleanName, // FIX: Save the cleaned name to the database
    ...(veg !== undefined && { veg }), // Safety check in case veg is false
    ...(image && { image }),
    ...(isAvailable !== undefined && { isAvailable }),
  };

  // 5) Save to Database
  const newCategory = await MenuCategory.create(categoryData);

  // 6) Send Response
  res.status(201).json({
    success: true,
    message: "Menu category created successfully.",
    data: newCategory,
  });
});
// Delete category
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const { categoryId } = req.params;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    // delete category directly
    const category = await MenuCategory.findByIdAndDelete(categoryId);

    if (!category) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("Category not found", 404));
    }

    // delete related items
    await MenuItem.deleteMany({
      categoryId,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: "Category permanently deleted",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return next(err);
  }
});

exports.uploadCategoryImage = catchAsync(async (req, res, next) => {
  // Check image

  const { id } = req.params;
  if (!req.file) {
    return next(new AppError("Please provide an image", 400));
  }

  // 2) Find category
  const category = await MenuCategory.findById(id);

  if (!category) {
    return next(new AppError("Category not found", 404));
  }

  // 3. Store image info in DB
  category.image = {
    url: req.file.path,
    publicId: req.file.filename,
  };

  await category.save();

  // 4. Response
  res.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
});

// Add new Item

exports.createMenuItem = catchAsync(async (req, res, next) => {
  const {
    hotelId,
    categoryId,
    name,
    price,
    veg,
    desc,
    itemImg,
    options,
    isAvailable,
  } = req.body;

  // 1. Validate required core fields
  if (!hotelId) {
    return next(new AppError(`Please provide hotelId`, 400));
  }

  if (!categoryId) {
    return next(new AppError(`Please provide categoryId`, 400));
  }

  if (!name) {
    return next(new AppError(`Please provide name`, 400));
  }

  if (price === undefined) {
    return next(new AppError(`Please provide price`, 400));
  }

  // 2. Ensure price is not negative
  if (price < 0) {
    return next(new AppError("Price can't be negative", 400));
  }

  // 3. Validate MongoDB ObjectIds to prevent casting errors
  if (
    !mongoose.Types.ObjectId.isValid(hotelId) ||
    !mongoose.Types.ObjectId.isValid(categoryId)
  ) {
    return next(new AppError("Invalid hotelId or categoryId format.", 400));
  }

  // 4. Verify the Category exists AND belongs to the correct Hotel
  const validCategory = await MenuCategory.findOne({
    _id: categoryId,
    hotelId: hotelId,
    softDeleted: false,
  });

  if (!validCategory) {
    return next(
      new AppError(
        "The specified category does not exist for this hotel, or it has been deleted.",
        400,
      ),
    );
  }

  // 5. Check for duplicate items within the SAME category
  const existingItem = await Items.findOne({
    hotelId,
    categoryId,
    name: name.trim(),
    softDeleted: false,
  });

  if (existingItem) {
    return next(
      new AppError(
        `An item named '${name}' already exists in this category.`,
        409,
      ),
    );
  }

  // 6. Construct the payload
  const itemData = {
    hotelId,
    categoryId,
    veg,
    name,
    price,
    ...(desc && { desc }),
    ...(itemImg && { itemImg }),
    ...(options && { options }), // Mongoose will automatically validate the nested option schema
    ...(isAvailable !== undefined && { isAvailable }),
  };

  // 7. Create and save the new item
  const newItem = await Items.create(itemData);

  res.status(201).json({
    success: true,
    message: "Menu item created successfully.",
    data: newItem,
  });
});

// Get menuItem view data
exports.getMenuItemViewData = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotelId"));
  }

  // Run in parallel (important for performance)
  const [categories, items] = await Promise.all([
    MenuCategory.find({ hotelId }).select("_id categoryName").lean(),

    MenuItem.find({ hotelId })
      .select(
        "_id name veg price desc categoryId options isAvailable softDeleted itemImg",
      )
      .lean(),
  ]);

  res.status(200).json({
    status: "success",
    data: {
      categories,
      items,
    },
  });
});

// update menuItem
exports.updateMenuItem = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;

  const ALLOWED_FIELDS = ["name", "price", "desc", "veg", "itemImg"];

  const updates = Object.keys(req.body)
    .filter((key) => ALLOWED_FIELDS.includes(key))
    .reduce(
      (acc, key) => ({
        ...acc,
        [key]: req.body[key],
      }),
      {},
    );

  if (Object.keys(updates).length === 0) {
    return next(new AppError("No valid fields procided", 400));
  }

  // ── Field-level validations ──────────────────────────────────────────────
  if (updates.price !== undefined && updates.price < 0) {
    return next(new AppError("Price cann't be negative", 400));
  }

  if (updates.desc !== undefined && updates.desc.length < 10) {
    return next(
      new AppError("Description must be at least 10 characters", 400),
    );
  }

  if (updates.veg !== undefined && typeof updates.veg !== "boolean") {
    return next(new AppError("veg must be boolean", 400));
  }

  if (updates.itemImg !== undefined) {
    const { url, publicId } = updates.itemImg;
    if (typeof url !== "string" || typeof publicId !== "string") {
      return next(
        new AppError("itemImg must have url and publicId as strings", 400),
      );
    }
  }

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: false },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!item) {
    return next(new AppError("Menu item not found", 404));
  }

  res.status(200).json({
    message: `Item "${item.name}" updated successfully`,
    data: item,
  });
});

exports.addOption = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;
  const { name, required = false, choices = [] } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return next(new AppError("Option name is required", 400));
  }

  if (!Array.isArray(choices)) {
    return next(new AppError("Choices must be an array"));
  }

  // redefind
  const newOption = { name: name.trim(), required: true, choices };

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: false },
    { $push: { options: newOption } },
    { new: true, runValidators: true, select: "name options" },
  );

  if (!item) {
    return next(new AppError("Item not found", 400));
  }

  const addedOption = item.options[item.options.length - 1];
  res.status(201).json({
    message: `Option "${addedOption.name}" added to item "${item.name}"`,
    data: { itemId: item._id, option: addedOption },
  });
});

exports.updateOption = catchAsync(async (req, res, next) => {
  const { itemId, optionId } = req.params;

  const ALLOWED_FIELDS = ["name", "required"];

  const updates = Object.keys(req.body)
    .filter((key) => ALLOWED_FIELDS.includes(key))
    .reduce(
      (acc, key) => ({ ...acc, [`options.$.${key}`]: req.body[key] }),
      {},
    );

  if (Object.keys(updates).length === 0) {
    return next(new AppError("No valid fields provided", 400));
  }

  if (req.body.name !== undefined && req.body.name.trim() === "") {
    return next(new AppError("Option name cannot be empty", 400));
  }

  if (
    req.body.required !== undefined &&
    typeof req.body.required !== "boolean"
  ) {
    return next(new AppError("required must be a boolean", 400));
  }

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: false, "options._id": optionId },
    { $set: updates },
    { new: true, runValidators: true, select: "name options" },
  );

  if (!item) {
    return next(new AppError("Menu item or option not found", 400));
  }

  const updatedOption = item.options.id(optionId);

  res.status(200).json({
    message: `Option "${updatedOption.name}" updated successfully`,
    data: { itemId: item._id, option: updatedOption },
  });
});

// ─── Add a new choice to an option ────────────────────────────────────────────

exports.addChoice = catchAsync(async (req, res, next) => {
  const { itemId, optionId } = req.params;
  const { name, priceMod = 0 } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return next(new AppError("Choice name is required", 400));
  }

  if (priceMod < 0) {
    return next(new AppError("Pricemod cann't be negative", 400));
  }

  const newChoice = { name: name.trim(), priceMod };

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: false, "options._id": optionId },
    { $push: { "options.$[opt].choices": newChoice } },
    {
      arrayFilters: [{ "opt._id": optionId }],
      new: true,
      runValidators: true,
      select: "name options",
    },
  );

  if (!item) {
    return next(new AppError("Menu item or option not found", 404));
  }

  const updatedOption = item.options.id(optionId);
  const addedChoice = updatedOption.choices[updatedOption.choices.length - 1];

  res.status(201).json({
    message: `Choice "${addedChoice.name}" added to option "${updatedOption.name}"`,
    data: { itemId: item._id, optionId, choice: addedChoice },
  });
});

// ─── Update an existing choice ────────────────────────────────────────────────

exports.updateChoice = catchAsync(async (req, res, next) => {
  const { itemId, optionId, choiceId } = req.params;

  const ALLOWED_FIELDS = ["name", "priceMod"];

  const rawUpdates = Object.keys(req.body)
    .filter((key) => ALLOWED_FIELDS.includes(key))
    .reduce((acc, key) => ({ ...acc, [key]: req.body[key] }), {});

  if (Object.keys(rawUpdates).length === 0) {
    return next(new AppError("No valid fields provided", 400));
  }

  if (rawUpdates.name !== undefined && rawUpdates.name.trim() === "") {
    return next(new AppError("Choice name cannot be empty", 400));
  }

  if (rawUpdates.priceMod !== undefined && rawUpdates.priceMod < 0) {
    return next(new AppError("Menu item, option, or choice not found", 400));
  }

  // Map updates to the nested path
  const updates = Object.keys(rawUpdates).reduce(
    (acc, key) => ({
      ...acc,
      [`options.$[opt].choices.$[choice].${key}`]: rawUpdates[key],
    }),
    {},
  );

  const item = await MenuItem.findOneAndUpdate(
    {
      _id: itemId,
      softDeleted: false,
      "options._id": optionId,
      "options.choices._id": choiceId,
    },
    { $set: updates },
    {
      arrayFilters: [{ "opt._id": optionId }, { "choice._id": choiceId }],
      new: true,
      runValidators: true,
      select: "name options",
    },
  );

  if (!item) {
    return next(new AppError("Menu item, option, or choice not found", 404));
  }

  const updatedOption = item.options.id(optionId);
  const updatedChoice = updatedOption.choices.id(choiceId);

  res.status(200).json({
    message: `Choice "${updatedChoice.name}" updated successfully`,
    data: { itemId: item._id, optionId, choice: updatedChoice },
  });
});

// UPDATE
exports.updateItemAvailability = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== "boolean") {
    return next(new AppError("isAvailable must be a boolean", 400));
  }

  const item = await MenuItem.findOneAndUpdate(
    { _id: id, softDeleted: false },
    { isAvailable },
    { new: true, select: "name isAvailable" },
  );

  if (!item) {
    return next(new AppError("Menu item not found"));
  }

  res.status(200).json({
    success: true,
    message: `Item "${item.name}" is now ${isAvailable ? "available" : "unavailable"}`,
    data: item,
  });
});

exports.updateOptionAvailability = catchAsync(async (req, res, next) => {
  const { itemId, optionId } = req.params;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== "boolean") {
    return next(new AppError("isAvailable must be a boolean", 400));
  }

  const item = await MenuItem.findOneAndUpdate(
    {
      _id: itemId,
      softDeleted: false,
      "options._id": optionId,
    },
    { $set: { "options.$.isAvailable": isAvailable } },
    { new: true, select: "name options" },
  );

  if (!item) {
    return next(new AppError("Menu item or option not found", 400));
  }

  const updatedOption = item.options.id(optionId);

  res.status(200).json({
    message: `Option "${updatedOption.name}" is now ${isAvailable ? "available" : "unavailable"}`,
    data: { itemId: item._id, option: updatedOption },
  });
});

// ─── Toggle choice-level availability ─────────────────────────────────────────

exports.updateChoiceAvailability = catchAsync(async (req, res, next) => {
  const { itemId, optionId, choiceId } = req.params;
  const { isAvailable } = req.body;

  if (typeof isAvailable !== "boolean") {
    return next(new AppError("isAvailable must must be a boolean", 400));
  }

  // positional operator only matches the first array level, so we use
  // arrayFilters to precisely target the nested choice
  const item = await MenuItem.findOneAndUpdate(
    {
      _id: itemId,
      softDeleted: false,
      "options._id": optionId,
      "options.choices._id": choiceId,
    },
    {
      $set: {
        "options.$[opt].choices.$[choice].isAvailable": isAvailable,
      },
    },
    {
      arrayFilters: [{ "opt._id": optionId }, { "choice._id": choiceId }],
      new: true,
      select: "name options",
    },
  );

  if (!item) {
    return next(new AppError("Menu item, option, or choice not found", 404));
  }

  const updatedOption = item.options.id(optionId);
  const updatedChoice = updatedOption.choices.id(choiceId);

  res.status(200).json({
    data: { itemId: item._id, optionId, choice: updatedChoice },
  });
});

// ─── Soft delete item ──────────────────────────────────────────────────────────

exports.softDeleteItem = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: false },
    { softDeleted: true, softDeletedAt: new Date() },
    { new: true, select: "name softDeleted softDeletedAt" },
  );

  if (!item) {
    return next(new AppError("Menu item not found or already deleted"), 404);
  }

  res.status(200).json({
    message: `Item "${item.name}" has been soft deleted`,
    data: item,
  });
});

// ─── Restore soft deleted item ────────────────────────────────────────────────

exports.restoreItem = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: true },
    { softDeleted: false, softDeletedAt: null },
    { new: true, select: "name softDeleted softDeletedAt" },
  );

  if (!item) {
    return next(new AppError("Menu item not found or not deleted"));
  }

  res.status(200).json({
    message: `Item "${item.name}" has been restored`,
    data: item,
  });
});

// ─── Hard delete item ─────────────────────────────────────────────────────────

exports.hardDeleteItem = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;

  const item = await MenuItem.findOneAndDelete({ _id: itemId });

  if (!item) {
    return next(new AppError("Menu item not found", 404));
  }

  res.status(200).json({
    message: `Item "${item.name}" has been permanently deleted`,
    data: { deletedId: item._id },
  });
});

// ─── Delete option from item ──────────────────────────────────────────────────

exports.deleteOption = catchAsync(async (req, res, next) => {
  const { itemId, optionId } = req.params;

  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, softDeleted: false, "options._id": optionId },
    { $pull: { options: { _id: optionId } } },
    { new: true, select: "name options" },
  );

  if (!item) {
    return next(new AppError("Menu item or option not found", 404));
  }

  res.status(200).json({
    message: `Option has been deleted from item "${item.name}"`,
    data: { itemId: item._id, remainingOptions: item.options },
  });
});

// ─── Delete choice from option ────────────────────────────────────────────────

exports.deleteChoice = catchAsync(async (req, res, next) => {
  const { itemId, optionId, choiceId } = req.params;

  const item = await MenuItem.findOneAndUpdate(
    {
      _id: itemId,
      softDeleted: false,
      "options._id": optionId,
      "options.choices._id": choiceId,
    },
    {
      $pull: { "options.$[opt].choices": { _id: choiceId } },
    },
    {
      arrayFilters: [{ "opt._id": optionId }],
      new: true,
      select: "name options",
    },
  );

  if (!item) {
    return next(new AppError("Menu item, option, or choice not found", 404));
  }

  const updatedOption = item.options.id(optionId);

  res.status(200).json({
    message: `Choice has been deleted from option "${updatedOption.name}"`,
    data: {
      itemId: item._id,
      optionId,
      remainingChoices: updatedOption.choices,
    },
  });
});
