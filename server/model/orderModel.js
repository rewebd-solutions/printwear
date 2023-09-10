const mongoose = require("mongoose");

var OrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart'
    },
    items: [
        {
            cartItemId: String,
            shippingAddress: {
                firstName: String,
                lastName: String,
                mobile: String,
                email: String,
                streetLandmark: String,
                city: String,
                pincode: Number,
                state: String,
                country: String
            },
            sku: String,
            SRorderId: String,
        }
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
        country: String
    },
    totalAmount: Number,
    amountPaid: {
        default: 0,
        type: Number
    },
    paymentStatus: {
        type: String,
        default: "pending",
        enum: ["pending", "success", "failed"]
    },
    deliveryStatus: {
        type: String,
        default: "placed"
    },
    paymentLink: String,
    paymentLinkId: String,
    CFOrderId: String,
    myOrderId: String
});

const orderModel = mongoose.model("Order", OrderSchema);

module.exports = orderModel;