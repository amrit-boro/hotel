const catchAsync = require("../utils/catchAsync");
const MenuItem = require("../models/menuItem");
const mongoose = require("mongoose"); // Import mongoose for ID validation
const menuPermission = require("../utils/checkMenuPermision");
const Hotel = require("../models/hotel");
const HotelStaff = require("../models/hotelStuff");
const AppError = require("../utils/appError");
const APIFeatures = require("../utils/apiFeatures");

/**
 * Helper function to find menu item by ID with validation
 */
const findMenuItemById = async (id, next) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Invalid menu item id", 400));
  }

  const menuItem = await MenuItem.findById(id);
  if (!menuItem) {
    return next(new AppError("Menu item not found", 404));
  }

  return menuItem;
};

/**
 * Helper function to validate item index
 */
const validateItemIndex = (menuItem, itemIndex, next) => {
  if (itemIndex < 0 || itemIndex >= menuItem.items.length) {
    return next(new AppError("Invalid item index", 400));
  }
  return true;
};

/**
 * Helper function to validate option index
 */
const validateOptionIndex = (menuItem, itemIndex, optionIndex, next) => {
  if (
    optionIndex < 0 ||
    optionIndex >= menuItem.items[itemIndex].options.length
  ) {
    return next(new AppError("Invalid option index", 400));
  }
  return true;
};

/**
 * Helper function to validate choice index
 */
const validateChoiceIndex = (
  menuItem,
  itemIndex,
  optionIndex,
  choiceIndex,
  next,
) => {
  if (
    choiceIndex < 0 ||
    choiceIndex >= menuItem.items[itemIndex].options[optionIndex].choices.length
  ) {
    return next(new AppError("Invalid choice index", 400));
  }
  return true;
};

// Get all menu items for a hotel (with filtering)
// exports.getMenuItems = catchAsync(async (req, res) => {
//   const { hotelId } = req.params;
//   console.log(hotelId);
//   const { category, veg, isAvailable, softDeleted } = req.query;

//   const query = { hotelId, softDeleted: softDeleted === "true" };

//   if (category) query.category = category;
//   if (veg) query.veg = veg === "true";
//   if (isAvailable) query.isAvailable = isAvailable === "true";

//   const menuItems = await MenuItem.find(query);
//   res.status(200).json({ success: true, data: menuItems });
// });

exports.getAvailableMenuItems = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  const { category, veg } = req.query;
  console.log(req.query);

  // Build query for menu level
  const query = {
    hotelId,
    isAvailable: true, // Only available menus
    softDeleted: false, // Only non-deleted menus
  };

  if (category) query.category = category;
  if (veg) query.veg = veg === "true";

  // Fetch menu items
  const menuItems = await MenuItem.find(query);

  // Filter items, options, and choices at all nested levels
  const filteredMenuItems = menuItems.map((menu) => {
    const menuObj = menu.toObject();

    // Filter items: only available and not soft deleted
    const availableItems = menuObj.items.filter(
      (item) => item.isAvailable === true && item.softDeleted === false,
    );

    // Further filter options and choices for each item
    const filteredItems = availableItems.map((item) => {
      // Filter options: only available options
      const availableOptions =
        item.options?.filter((option) => option.isAvailable === true) || [];

      // Filter choices within each option: only available choices
      const filteredOptions = availableOptions.map((option) => ({
        ...option,
        choices:
          option.choices?.filter((choice) => choice.isAvailable === true) || [],
      }));

      return {
        ...item,
        options: filteredOptions,
      };
    });

    return {
      ...menuObj,
      items: filteredItems,
    };
  });

  // Only return menu categories that have at least one available item
  const nonEmptyMenuItems = filteredMenuItems.filter(
    (menu) => menu.items.length > 0,
  );

  res.status(200).json({
    success: true,
    count: nonEmptyMenuItems.length,
    data: nonEmptyMenuItems,
  });
});

/**
 * 5) Create a complete menu with multiple items
 */
exports.createMenu = catchAsync(async (req, res, next) => {
  let { hotelId, category, veg, image, items, isAvailable } = req.body;

  // Convert string booleans (FormData → string)
  veg = veg === "true";
  isAvailable = isAvailable === "false" ? false : true;

  // Parse items (VERY IMPORTANT for FormData)
  try {
    items = typeof items === "string" ? JSON.parse(items) : items;
  } catch (err) {
    return next(new AppError("Invalid items format (must be JSON)", 400));
  }

  // Validate required fields
  if (!hotelId) {
    return next(new AppError("Hotel ID is required", 400));
  }

  if (!category) {
    return next(new AppError("Category is required", 400));
  }

  if (veg === undefined || veg === null) {
    return next(new AppError("Veg/Non-veg status is required", 400));
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError("At least one menu item is required", 400));
  }

  // Validate items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.name) {
      return next(new AppError(`Item at index ${i} must have a name`, 400));
    }

    // Convert price if string
    item.price = Number(item.price);

    if (isNaN(item.price) || item.price < 0) {
      return next(
        new AppError(`Item at index ${i} must have a valid price`, 400),
      );
    }

    if (item.desc && item.desc.length < 10) {
      return next(
        new AppError(
          `Item at index ${i} description must be at least 10 characters`,
          400,
        ),
      );
    }

    // Options
    if (item.options && Array.isArray(item.options)) {
      for (let j = 0; j < item.options.length; j++) {
        const option = item.options[j];

        if (!option.name) {
          return next(
            new AppError(
              `Option at index ${j} for item ${i} must have a name`,
              400,
            ),
          );
        }

        if (option.choices && Array.isArray(option.choices)) {
          for (let k = 0; k < option.choices.length; k++) {
            const choice = option.choices[k];

            if (!choice.name) {
              return next(
                new AppError(
                  `Choice at index ${k} for option ${j} in item ${i} must have a name`,
                  400,
                ),
              );
            }

            // Convert priceMod if string
            choice.priceMod = Number(choice.priceMod || 0);

            if (isNaN(choice.priceMod) || choice.priceMod < 0) {
              return next(
                new AppError(`Invalid price modifier at choice ${k}`, 400),
              );
            }
          }
        }
      }
    }
  }

  // Prepare data
  const menuItemData = {
    hotelId,
    category,
    veg,
    image: image || { url: "", publicId: "" },
    isAvailable,
    items: items.map((item) => ({
      ...item,
      softDeleted: false,
      softDeletedAt: null,
      isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
      rating: item.rating || 0,
      itemImg: item.itemImg || { url: "", publicId: "" },
      options: (item.options || []).map((option) => ({
        ...option,
        isAvailable:
          option.isAvailable !== undefined ? option.isAvailable : true,
        choices: (option.choices || []).map((choice) => ({
          ...choice,
          isAvailable:
            choice.isAvailable !== undefined ? choice.isAvailable : true,
          priceMod: choice.priceMod || 0,
        })),
      })),
    })),
    ratings: {
      average: 0,
      count: 0,
    },
    softDeleted: false,
    softDeletedAt: null,
  };

  const newMenu = await MenuItem.create(menuItemData);

  res.status(201).json({
    status: "success",
    message: "Menu created successfully",
    data: {
      menu: newMenu,
      itemsCount: newMenu.items.length,
    },
  });
});
/**
 * 1) Soft delete an item (mark as deleted but keep in database)
 */
exports.softDeleteItem = catchAsync(async (req, res, next) => {
  const { id, itemIndex } = req.params;

  // Find and validate menu item
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  // Validate item index
  const idx = parseInt(itemIndex);
  if (!validateItemIndex(menuItem, idx, next)) return;

  // Check if already soft deleted
  if (menuItem.items[idx].softDeleted) {
    return next(new AppError("Item is already soft deleted", 400));
  }

  // Apply soft delete
  menuItem.items[idx].softDeleted = true;
  menuItem.items[idx].softDeletedAt = new Date();
  menuItem.items[idx].isAvailable = false; // Also mark as unavailable

  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: "Item soft deleted successfully",
    data: {
      item: menuItem.items[idx],
      menuItemId: menuItem._id,
    },
  });
});

// Add new Item
exports.addNewItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  let { name, price, desc, rating, options, isAvailable } = req.body;

  // --- Parse FormData values ---
  price = price !== undefined ? Number(price) : undefined;
  rating = rating !== undefined ? Number(rating) : 0;
  isAvailable = isAvailable !== undefined ? isAvailable === "true" : true;

  // options will come as string → parse it
  if (options) {
    try {
      options = JSON.parse(options);
    } catch (err) {
      return next(new AppError("Invalid JSON format for options", 400));
    }
  } else {
    options = [];
  }

  // --- Image (from multer / cloudinary middleware) ---
  const itemImg = req.file
    ? {
        url: req.file.path || req.file.secure_url,
        publicId: req.file.filename || req.file.public_id,
      }
    : { url: "", publicId: "" };

  // --- Validation ---
  if (!name) {
    return next(new AppError("Item name is required", 400));
  }

  if (price === undefined || isNaN(price) || price < 0) {
    return next(new AppError("Valid price is required", 400));
  }

  if (desc && desc.length < 10) {
    return next(
      new AppError("Description must be at least 10 characters", 400),
    );
  }

  // --- Find menu ---
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  if (menuItem.softDeleted) {
    return next(new AppError("Cannot add item to deleted menu", 400));
  }

  // --- Validate options ---
  if (!Array.isArray(options)) {
    return next(new AppError("Options must be an array", 400));
  }

  for (let i = 0; i < options.length; i++) {
    const option = options[i];

    if (!option.name) {
      return next(new AppError(`Option ${i} must have a name`, 400));
    }

    if (option.choices && Array.isArray(option.choices)) {
      for (let j = 0; j < option.choices.length; j++) {
        const choice = option.choices[j];

        if (!choice.name) {
          return next(
            new AppError(`Choice ${j} in option ${i} must have a name`, 400),
          );
        }

        // normalize priceMod
        choice.priceMod =
          choice.priceMod !== undefined ? Number(choice.priceMod) : 0;

        if (isNaN(choice.priceMod) || choice.priceMod < 0) {
          return next(
            new AppError(`Invalid priceMod in choice ${j} of option ${i}`, 400),
          );
        }

        choice.isAvailable =
          choice.isAvailable !== undefined
            ? choice.isAvailable === true || choice.isAvailable === "true"
            : true;
      }
    } else {
      option.choices = [];
    }

    option.required =
      option.required !== undefined
        ? option.required === true || option.required === "true"
        : false;

    option.isAvailable =
      option.isAvailable !== undefined
        ? option.isAvailable === true || option.isAvailable === "true"
        : true;
  }

  // --- Create item ---
  const newItem = {
    name: name.trim(),
    price,
    desc: desc ? desc.trim() : "",
    rating,
    isAvailable,
    itemImg,
    options,
  };

  // --- Save ---
  menuItem.items.push(newItem);
  await menuItem.save();

  const addedItem = menuItem.items.at(-1);

  res.status(201).json({
    status: "success",
    message: "Item added successfully",
    data: {
      item: addedItem,
      itemIndex: menuItem.items.length - 1,
      menuItemId: menuItem._id,
      totalItems: menuItem.items.length,
    },
  });
});

// Hard Delete item
/**
 * Hard delete an item from existing menu
 */
exports.hardDeleteItem = catchAsync(async (req, res, next) => {
  const { id, itemIndex } = req.params;

  // Find menu item
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  // Validate item index
  const idx = parseInt(itemIndex);
  if (!validateItemIndex(menuItem, idx, next)) return;

  // Store the deleted item for response
  const deletedItem = menuItem.items[idx];

  // Remove item permanently
  menuItem.items.splice(idx, 1);
  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: "Item permanently deleted successfully",
    data: {
      deletedItem: deletedItem,
      remainingItems: menuItem.items.length,
      menuItemId: menuItem._id,
    },
  });
});

/**
 * 3) Restore a soft-deleted item
 */
exports.restoreSoftDeleteItem = catchAsync(async (req, res, next) => {
  const { id, itemIndex } = req.params;

  // Find menu item
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  // Validate item index
  const idx = parseInt(itemIndex);
  if (!validateItemIndex(menuItem, idx, next)) return;

  // Check if item is not soft deleted
  if (!menuItem.items[idx].softDeleted) {
    return next(new AppError("Item is not soft deleted", 400));
  }

  // Restore the item
  menuItem.items[idx].softDeleted = false;
  menuItem.items[idx].softDeletedAt = null;
  menuItem.items[idx].isAvailable = true; // Restore availability

  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: "Item restored successfully",
    data: {
      item: menuItem.items[idx],
      menuItemId: menuItem._id,
    },
  });
});

/**
 * Update an existing item
 */
exports.updateItem = catchAsync(async (req, res, next) => {
  const { id, itemIndex } = req.params;

  // guard (prevents destructure crash)
  if (!req.body) {
    return next(new AppError("Request body is missing", 400));
  }

  let { name, price, desc, options } = req.body;

  // --- Parse FormData values ---
  if (price !== undefined) price = Number(price);
  //   if (isAvailable !== undefined) isAvailable = isAvailable === "true";

  if (options) {
    try {
      options = JSON.parse(options);
    } catch (err) {
      return next(new AppError("Invalid JSON format for options", 400));
    }
  }

  // --- Image handling (multer / cloudinary) ---
  const itemImg = req.file
    ? {
        url: req.file.path || req.file.secure_url,
        publicId: req.file.filename || req.file.public_id,
      }
    : undefined;

  // --- Find menu ---
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  const idx = parseInt(itemIndex, 10);
  if (!validateItemIndex(menuItem, idx, next)) return;

  if (menuItem.items[idx].softDeleted) {
    return next(
      new AppError("Cannot update a soft deleted item. Restore it first.", 400),
    );
  }

  const item = menuItem.items[idx];

  // --- Update fields ---
  if (name) item.name = name.trim();

  if (price !== undefined) {
    if (isNaN(price) || price < 0) {
      return next(new AppError("Price must be a non-negative number", 400));
    }
    item.price = price;
  }

  if (desc !== undefined) {
    if (desc && desc.length < 10) {
      return next(
        new AppError("Description must be at least 10 characters", 400),
      );
    }
    item.desc = desc.trim();
  }

  if (rating !== undefined) {
    if (isNaN(rating) || rating < 0 || rating > 5) {
      return next(new AppError("Rating must be between 0 and 5", 400));
    }
    item.rating = rating;
  }

  if (isAvailable !== undefined) {
    item.isAvailable = isAvailable;
  }

  if (itemImg) {
    item.itemImg = itemImg;
  }

  // --- Validate + normalize options ---
  if (options !== undefined) {
    if (!Array.isArray(options)) {
      return next(new AppError("Options must be an array", 400));
    }

    for (let i = 0; i < options.length; i++) {
      const option = options[i];

      if (!option.name) {
        return next(new AppError(`Option ${i} must have a name`, 400));
      }

      option.required =
        option.required !== undefined
          ? option.required === true || option.required === "true"
          : false;

      option.isAvailable =
        option.isAvailable !== undefined
          ? option.isAvailable === true || option.isAvailable === "true"
          : true;

      if (option.choices && Array.isArray(option.choices)) {
        for (let j = 0; j < option.choices.length; j++) {
          const choice = option.choices[j];

          if (!choice.name) {
            return next(
              new AppError(`Choice ${j} in option ${i} must have a name`, 400),
            );
          }

          choice.priceMod =
            choice.priceMod !== undefined ? Number(choice.priceMod) : 0;

          if (isNaN(choice.priceMod) || choice.priceMod < 0) {
            return next(
              new AppError(
                `Invalid priceMod in choice ${j} of option ${i}`,
                400,
              ),
            );
          }

          choice.isAvailable =
            choice.isAvailable !== undefined
              ? choice.isAvailable === true || choice.isAvailable === "true"
              : true;
        }
      } else {
        option.choices = [];
      }
    }

    item.options = options;
  }

  // --- Save ---
  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: "Item updated successfully",
    data: {
      item,
      itemIndex: idx,
      menuItemId: menuItem._id,
    },
  });
});

/**
 * Update option availability
 */
exports.updateOptionAvailability = catchAsync(async (req, res, next) => {
  const { id, itemIndex, optionIndex } = req.params;
  const { isAvailable } = req.body;

  // Validate isAvailable parameter
  if (isAvailable === undefined || typeof isAvailable !== "boolean") {
    return next(new AppError("Please provide isAvailable as boolean", 400));
  }

  // Find menu item
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  // Validate item index
  const itemIdx = parseInt(itemIndex);
  if (!validateItemIndex(menuItem, itemIdx, next)) return;

  // Validate option index
  const optIdx = parseInt(optionIndex);
  if (!validateOptionIndex(menuItem, itemIdx, optIdx, next)) return;

  // Update option availability
  menuItem.items[itemIdx].options[optIdx].isAvailable = isAvailable;
  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: `Option ${isAvailable ? "enabled" : "disabled"} successfully`,
    data: {
      option: menuItem.items[itemIdx].options[optIdx],
      itemName: menuItem.items[itemIdx].name,
      optionIndex: optIdx,
      itemIndex: itemIdx,
      menuItemId: menuItem._id,
    },
  });
});

/**
 * Update choice availability
 */
exports.updateChoiceAvailability = catchAsync(async (req, res, next) => {
  const { id, itemIndex, optionIndex, choiceIndex } = req.params;
  const { isAvailable } = req.body;

  // Validate isAvailable parameter
  if (isAvailable === undefined || typeof isAvailable !== "boolean") {
    return next(new AppError("Please provide isAvailable as boolean", 400));
  }

  // Find menu item
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  // Validate indices
  const itemIdx = parseInt(itemIndex);
  const optIdx = parseInt(optionIndex);
  const choiceIdx = parseInt(choiceIndex);

  if (!validateItemIndex(menuItem, itemIdx, next)) return;
  if (!validateOptionIndex(menuItem, itemIdx, optIdx, next)) return;
  if (!validateChoiceIndex(menuItem, itemIdx, optIdx, choiceIdx, next)) return;

  // Update choice availability
  menuItem.items[itemIdx].options[optIdx].choices[choiceIdx].isAvailable =
    isAvailable;
  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: `Choice ${isAvailable ? "enabled" : "disabled"} successfully`,
    data: {
      choice: menuItem.items[itemIdx].options[optIdx].choices[choiceIdx],
      choiceIndex: choiceIdx,
      optionName: menuItem.items[itemIdx].options[optIdx].name,
      itemName: menuItem.items[itemIdx].name,
      menuItemId: menuItem._id,
    },
  });
});

/**
 * Hard delete a choice
 */
exports.deleteChoice = catchAsync(async (req, res, next) => {
  const { id, itemIndex, optionIndex, choiceIndex } = req.params;

  // Find menu item
  const menuItem = await findMenuItemById(id, next);
  if (!menuItem) return;

  // Validate indices
  const itemIdx = parseInt(itemIndex);
  const optIdx = parseInt(optionIndex);
  const choiceIdx = parseInt(choiceIndex);

  if (!validateItemIndex(menuItem, itemIdx, next)) return;
  if (!validateOptionIndex(menuItem, itemIdx, optIdx, next)) return;
  if (!validateChoiceIndex(menuItem, itemIdx, optIdx, choiceIdx, next)) return;

  // Store deleted choice for response
  const deletedChoice =
    menuItem.items[itemIdx].options[optIdx].choices[choiceIdx];

  // Remove choice permanently
  menuItem.items[itemIdx].options[optIdx].choices.splice(choiceIdx, 1);
  await menuItem.save();

  res.status(200).json({
    status: "success",
    message: "Choice deleted successfully",
    data: {
      deletedChoice: deletedChoice,
      remainingChoices: menuItem.items[itemIdx].options[optIdx].choices.length,
      optionName: menuItem.items[itemIdx].options[optIdx].name,
      itemName: menuItem.items[itemIdx].name,
      menuItemId: menuItem._id,
    },
  });
});
