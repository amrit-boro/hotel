const catchAsync = require("../utils/catchAsync");
const Items = require("../models/item");
const MenuCategory = require("../models/menuCategory");
const MenuItem = require("../models/item");
const mongoose = require("mongoose"); // Import mongoose for ID validation
const AppError = require("../utils/appError");

// Get menu
exports.menuDetails = catchAsync(async (req, res, next) => {
  console.log("hello from the menuDetils");
  const { hotelId } = req.params;

  // Validate hotelId
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotelId"));
  }

  // 2) fetch categories
  const categories = await MenuCategory.find({
    hotelId,
    isAvailable: true,
    softDeleted: false,
  })
    .select("_id name veg")
    .lean();

  // 3 fetch Item
  const items = await MenuItem.find({
    hotelId,
    isAvailable: true,
    softDeleted: true,
  })
    .select("categoryId name price desc rating itemImg options")
    .lean();

  const itemsMap = {};
  for (const item of items) {
    const key = item.categoryId.toString();
    if (!itemsMap[key]) {
      itemsMap[key] = [];
    }

    itemsMap[key].push(item);
  }

  const result = categories.map((cat) => ({
    _id: cat._id,
    name: cat.name,
    veg: cat.veg,
    items: itemsMap[cat._id.toString()] || [],
  }));

  res.status(200).json({
    status: "success",
    results: result.length,
    data: result,
  });
});

/**
 * 5) Create a complete menu with multiple items
 */
exports.createCategory = catchAsync(async (req, res, next) => {
  const { hotelId, categoryName, veg, image, isAvailable } = req.body;

  // 1) Validation required fileds
  if (!hotelId) {
    return next(new AppError("HotelId requireds", 400));
  }

  if (!categoryName) {
    return next(new AppError("Category Name required", 400));
  }

  // 2) Validate mongodb object
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotelId format"));
  }

  // 3) Check for duplicate category name within the same hotel
  const existingCategory = await MenuCategory.findOne({
    hotelId,
    categoryName,
    isAvailable: true,
  });

  if (existingCategory) {
    return next(
      new AppError(
        `Category '${categoryName}' already exists for this hotel.`,
        400,
      ),
    );
  }

  // 4. Construct the payload
  const categoryData = {
    hotelId,
    categoryName,
    veg,
    ...(image && { image }), // Only add image if it exists in the request
    ...(isAvailable !== undefined && { isAvailable }), // Fallback to schema default if not provided
  };

  const newCategory = MenuCategory.create(categoryData);

  res.status(201).json({
    success: true,
    message: "Menu category created successfully.",
    data: newCategory,
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

  console.log(req.params, req.body);

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
