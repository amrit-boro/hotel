const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuCategory",
      required: true,
      index: true,
    },

    veg: {
      type: Boolean,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    desc: {
      type: String,
      minlength: 10,
      trim: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },

    itemImg: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    options: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },

        required: {
          type: Boolean,
          default: false,
        },

        isAvailable: {
          type: Boolean,
          default: true,
        },

        choices: [
          {
            name: {
              type: String,
              required: true,
              trim: true,
            },

            priceMod: {
              type: Number,
              default: 0,
              min: 0,
            },

            isAvailable: {
              type: Boolean,
              default: true,
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
        ],

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
    ],

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

const MenuItem = mongoose.model("MenuItem", MenuItemSchema);
module.exports = MenuItem;
