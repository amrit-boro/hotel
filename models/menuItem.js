const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: false,
      default: "",
    },
    veg: {
      type: Boolean,
      required: true,
      default: true,
      index: true, // for filtering veg/non-veg items
    },
    price: { type: Number, required: true, min: 0 }, // Base Price
    image: {
      url: { type: String, default: "" }, // For the Frontend (<img> src)
      publicId: { type: String, default: "" }, // For the Backend (Cloudinary Delete)
    },
    isAvailable: { type: Boolean, default: true, index: true },

    // --- The Updated Options Section ---
    options: [
      {
        name: String, // e.g., "Size", "Spiciness", "Add-ons"
        required: { type: Boolean, default: false },
        choices: [
          {
            name: String, // e.g., "Large", "Extra Cheese"
            priceMod: { type: Number, default: 0, min: 0 }, // Added cost
            isAvailable: { type: Boolean, default: undefined, index: true },
          },
        ],
      },
    ],

    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  },
);

// Add after your schema definition
// Create indexes for better query performance
// MenuItemSchema.index({ hotelId: 1, isAvailable: 1 });
// MenuItemSchema.index({ category: 1, isAvailable: 1 });
// MenuItemSchema.index({ name: "text", description: "text" });
// MenuItemSchema.index({ "options.choices.isAvailable": 1 });

const MenuItem = mongoose.model("MenuItem", MenuItemSchema);
module.exports = MenuItem;
