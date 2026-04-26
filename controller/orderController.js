const Order = require("../models/order");
const MenuItem = require("../models/menuItem");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Hotel = require("../models/hotel");
const QRCode = require("qrcode");

exports.createOrder = catchAsync(async (req, res, next) => {
  // 1. EXTRACT DATA
  // Frontend sends 'tableNo', but we will map it to 'tableId' later
  const { hotelId, tableNo, items, notes } = req.body;

  // 2. BASIC VALIDATION
  if (!hotelId) return next(new AppError("Hotel ID is required", 400));
  if (!tableNo) return next(new AppError("Table Number is required", 400));
  if (!items || items.length === 0)
    return next(new AppError("Order is empty", 400));

  let calculatedTotalAmount = 0;
  const orderItemsSnapshot = [];

  // 3. PROCESS ITEMS (Security & Snapshotting)
  for (const item of items) {
    // A. Fetch Real Product from DB (Don't trust frontend price)
    // Frontend sends 'menuItem' as ID
    const menuProduct = await MenuItem.findById(item.menuItem);

    if (!menuProduct) {
      return next(new AppError(`Item not found: ${item.menuItem}`, 404));
    }

    // B. Security: Verify Hotel Ownership
    if (menuProduct.hotelId.toString() !== hotelId) {
      return next(
        new AppError(
          `Item ${menuProduct.name} does not belong to this hotel`,
          403
        )
      );
    }

    // C. Calculate Price (Base + Modifiers)
    let currentItemPrice = menuProduct.price;

    if (item.selectedOptions && item.selectedOptions.length > 0) {
      item.selectedOptions.forEach((opt) => {
        // Ensure priceMod is a number
        const modPrice = Number(opt.priceMod) || 0;
        currentItemPrice += modPrice;
      });
    }

    const itemTotal = currentItemPrice * item.quantity;
    calculatedTotalAmount += itemTotal;

    // D. BUILD SNAPSHOT (Strictly match OrderItemSchema)
    orderItemsSnapshot.push({
      menuItemId: menuProduct._id, // ✅ SCHEMA REQUIRES 'menuItemId'
      name: menuProduct.name,
      price: menuProduct.price, // Base price snapshot
      selectedOptions: item.selectedOptions,
      quantity: item.quantity,
      itemTotal: itemTotal, // ✅ Calculated Total
    });
  }

  // 4. CREATE ORDER IN DB
  const newOrder = await Order.create({
    hotelId,
    tableId: tableNo, // ✅ MAPPING: Frontend 'tableNo' -> Schema 'tableId'
    items: orderItemsSnapshot,
    totalAmount: calculatedTotalAmount,
    notes,
    status: "pending",
  });

  // 5. SOCKET: RING KITCHEN & NOTIFY CUSTOMER
  // Ensure 'req.io' exists (passed from app.js middleware)
  if (req.io) {
    // Notify Kitchen
    req.io.to(`kitchen_${hotelId}`).emit("new_order", newOrder);
    console.log(`🔔 Ringing Kitchen: kitchen_${hotelId}`);

    // Notify Customer (Confirmation)
    req.io.to(`table_${tableNo}`).emit("order_confirmed", {
      orderId: newOrder._id,
      msg: "Kitchen has received your order! 👨‍🍳",
    });
  }

  // 6. SEND RESPONSE
  res.status(201).json({
    success: true,
    data: newOrder,
  });
});
// GET Orders (For Kitchen Dashboard)---------------------------
exports.getOrders = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  console.log("hotelId:", hotelId);

  // Fetch active orders (Pending or Preparing)
  // Sorted by oldest first (FIFO - First In, First Out)
  const orders = await Order.find({
    hotelId,
    status: { $in: ["pending", "preparing", "ready"] },
  }).sort({ createdAt: 1 });

  res.status(200).json({ success: true, count: orders.length, data: orders });
});

exports.qr = catchAsync(async (req, res, next) => {
  const { tabeId: tableId } = req.params;
  // const userId = req.user._id.toString();
  const userId = "692682bca037189d52672650";

  // 1. Find the Hotel this user owns
  // (In a real app, you might pass hotelId in params, but this works for single-hotel owners)
  const hotel = await Hotel.findOne({ ownerId: userId });
  if (!hotel) return next(new AppError("Hotel not found", 404));

  // 2. Construct the Customer URL
  // REPLACE with your actual Frontend Domain (or Local IP for testing)
  const FRONTEND_URL = "http://10.225.49.165:5173";
  const link = `${FRONTEND_URL}/menu/${hotel._id}/${tableId}`;
  // 3. Generate QR as a Data URL (Image)
  const qrImage = await QRCode.toDataURL(link);

  // 4. Send it back as an image response
  // We send a simple HTML page to visualize it immediately
  res.send(`
    <div style="text-align:center; padding-top: 50px;">
      <h1>Table ${tableId}</h1>
      <img src="${qrImage}" style="width:300px; height:300px; border: 2px solid #333;"/>
      <p style="font-family: monospace;">${link}</p>
      <button onclick="window.print()">Print this QR</button>
    </div>
  `);
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body; // e.g., 'preparing', 'ready'
  const { id } = req.params;

  // 1. Update DB
  const order = await Order.findByIdAndUpdate(id, { status }, { new: true });

  if (!order) return next(new AppError("Order not found", 404));

  // 2. 🔔 NOTIFY EVERYONE (Kitchen + Customer)
  // Notify Kitchen (to sync other screens)
  req.io.to(`kitchen_${order.hotelId}`).emit("order_updated", order);

  // Notify Customer Table (So their phone updates)
  req.io.to(`table_${order.tableId}`).emit("order_status_updated", {
    orderId: order._id,
    status: status,
  });

  console.log(`📡 Update sent to table_${order.tableId}: ${order.status}`);

  res.status(200).json({ success: true, data: order });
});
