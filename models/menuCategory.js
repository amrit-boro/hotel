const mongoose = require("mongoose");

// new Schema
const MenuCategorySchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    categoryName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    veg: {
      type: Boolean,
      required: true,
      index: true,
    },

    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },

    softDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    softDeletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// MenuCategorySchema.index({ hotelId: 1, name: 1 });

const MenuCategory = mongoose.model("MenuCategory", MenuCategorySchema);
module.exports = MenuCategory;
