const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hotel",
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  description: String, // Useful for the menu UI (e.g., ingredients)
  price: { type: Number, required: true }, // Base Price
  category: { type: String, required: true }, // e.g., "Starters"
  image: {
    url: String, // For the Frontend (<img> src)
    publicId: String, // For the Backend (Cloudinary Delete)
  },
  isAvailable: { type: Boolean, default: true },

  // --- The Updated Options Section ---
  options: [
    {
      name: String, // e.g., "Size", "Spiciness", "Add-ons"

      // The flag we discussed:
      // true = User MUST pick one (Radio button behavior)
      // false = User CAN pick multiple or none (Checkbox behavior)
      required: { type: Boolean, default: false },

      choices: [
        {
          name: String, // e.g., "Large", "Extra Cheese"
          priceMod: { type: Number, default: 0 }, // Added cost
        },
      ],
    },
  ],

  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
  },

  createdAt: { type: Date, default: Date.now },
});

const MenuItem = mongoose.model("MenuItem", MenuItemSchema);
module.exports = MenuItem;
