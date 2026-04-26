const mongoose = require("mongoose");

// Sub-schema for individual items in the cart
const OrderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  name: { type: String, required: true }, // SNAPSHOT (e.g. "Spicy Pizza")
  // Financial Snapshot
  price: { type: Number, required: true }, // SNAPSHOT (e.g. 350)
  // The specific modifiers the user picked
  selectedOptions: [
    {
      name: String, // e.g. "Size" or "Toppings"
      choice: String, // e.g. "Large" or "Extra Cheese"
      priceMod: Number, // Snapshot: The cost added (e.g., 4.00)
    },
  ],

  quantity: { type: Number, required: true, min: 1 },

  // (basePrice + sum of priceMods) * quantity
  itemTotal: { type: Number, required: true },
});

const OrderSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hotel",
    required: true,
    index: true, // Indexed for fast Kitchen Dashboard lookup
  },

  // QR Data
  tableId: { type: String, required: true }, // e.g. "Table 5" or "5"

  // Array of items defined above
  items: [OrderItemSchema],

  // Financials
  totalAmount: { type: Number, required: true },

  // Kitchen Workflow State
  status: {
    type: String,
    enum: [
      "pending", // 1. Just arrived (flashing on tablet)
      "preparing", // 2. Chef accepted, is cooking
      "ready", // 3. Food is on the counter
      "served", // 4. Waiter delivered it
      "paid", // 5. Customer settled bill
      "cancelled",
    ],
    default: "pending",
    index: true, // Important for the Kitchen Dashboard query
  },

  // Optional: For simple requests like "Extra napkins"
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Middleware to update 'updatedAt' on save
OrderSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;
