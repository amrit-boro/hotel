const mongoose = require("mongoose");

// v1
// const MenuItemSchema = new mongoose.Schema(
//   {
//     hotelId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Hotel",
//       required: true,
//       index: true,
//     },
//     name: {
//       type: String,
//       required: true,
//       index: true,
//     },
//     category: {
//       type: String,
//       required: true,
//       index: true,
//     },
//     description: {
//       type: String,
//       required: false,
//       default: "",
//     },
//     veg: {
//       type: Boolean,
//       required: true,
//       default: true,
//       index: true, // for filtering veg/non-veg items
//     },
//     price: { type: Number, required: true, min: 0 }, // Base Price
//     image: {
//       url: { type: String, default: "" }, // For the Frontend (<img> src)
//       publicId: { type: String, default: "" }, // For the Backend (Cloudinary Delete)
//     },
//     isAvailable: { type: Boolean, default: true, index: true },

//     // --- The Updated Options Section ---
//     options: [
//       {
//         name: String, // e.g., "Size", "Spiciness", "Add-ons"
//         required: { type: Boolean, default: false },
//         isAvailable: { type: Boolean, default: true },
//         choices: [
//           {
//             name: String, // e.g., "Large", "Extra Cheese"
//             priceMod: { type: Number, default: 0, min: 0 }, // Added cost
//             isAvailable: { type: Boolean, default: undefined, index: true },
//           },
//         ],
//       },
//     ],

//     ratings: {
//       average: { type: Number, default: 0, min: 0, max: 5 },
//       count: { type: Number, default: 0 },
//     },
//     softDeleted: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },
//     softDeletedAt: {
//       type: Date,
//       default: null,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// Add after your schema definition
// Create indexes for better query performance
// MenuItemSchema.index({ hotelId: 1, isAvailable: 1 });
// MenuItemSchema.index({ category: 1, isAvailable: 1 });
// MenuItemSchema.index({ name: "text", description: "text" });
// MenuItemSchema.index({ "options.choices.isAvailable": 1 });

//v2
const MenuItemSchema = new mongoose.Schema(
  {
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      // adjust values as per your app
      enum: ["starter", "main", "dessert", "drink", "mutton"],
      index: true,
    },

    veg: {
      type: Boolean,
      required: true, // avoid silent defaults
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

    items: [
      {
        name: { type: String, required: true, trim: true },
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
              },
            ],
          },
        ],
        softDeleted: {
          type: Boolean,
          default: false,
        },
        softDeletedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Useful compound index
MenuItemSchema.index({ hotelId: 1, category: 1 });

const MenuItem = mongoose.model("MenuItem", MenuItemSchema);
module.exports = MenuItem;
