const mongoose = require("mongoose");

var OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "zohoProducts",
      },
      designId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "newDesign",
      },
      quantity: {
        type: Number,
        default: 1,
      },
      price: {
        type: Number,
        default: 0,
      },
    },
  ],
  billingAddress: {
    firstName: String,
    lastName: String,
    mobile: String,
    email: String,
    streetLandmark: String,
    city: String,
    pincode: Number,
    state: String,
    country: String,
  },
  shippingAddress: {
    firstName: String,
    lastName: String,
    mobile: String,
    email: String,
    streetLandmark: String,
    city: String,
    pincode: Number,
    state: String,
    country: String,
  },
  totalAmount: {
    default: 0,
    type: Number,
  },
  amountPaid: {
    default: 0,
    type: Number,
  },
  paymentStatus: {
    type: String,
    default: "pending",
    enum: ["pending", "success", "failed", "refund_init", "refunded"],
  },
  deliveryStatus: {
    type: String,
    default: "pending",
    enum: [
      "received",
      "ready-to-ship", // -> ready to ship
      "on-hold",
      "processing",
      "rto-delivered", // -> rto delivered
      "shipment-cancel",
      "pickup-scheduled",
      "out-for-pickup",
      "in-transit",
      "return-to-origin", // -> return to origin
      "return-init",
      "cancelled",
      "undelivered",
      "invoiced",
      "shipped",
      "delivered",
      "completed",
      "pending",
    ],
  },
  deliveryCharges: {
    type: Number,
    default: 0,
  },
  paymentLink: String,
  paymentLinkId: String,
  CashfreeOrderId: String,
  printwearOrderId: String,
  shipRocketOrderId: String,
  cashOnDelivery: {
    type: Boolean,
    default: false,
  },
  shipRocketCourier: {
    courierId: String,
    courierName: {
      type: String,
      default: "unassigned",
    },
    estimatedDelivery: {
      type: String,
      default: "N/A",
    },
    courierAWB: String,
  },
  customerOrderId: String,
  retailPrice: Number,
  shipmentId: String,
  createdAt: {
    type: mongoose.Schema.Types.Date,
    default: Date.now,
  },
  deliveredOn: {
    type: mongoose.Schema.Types.Date,
  },
  taxes: {
    type: Number,
    default: 0,
  },
  shopifyId: String,
  wooCommerceId: String,
});

const orderModel = mongoose.model("Order", OrderSchema);

module.exports = orderModel;