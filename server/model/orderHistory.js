const mongoose = require("mongoose");

var OrderHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    orderData: [
        {
            items: [
                {
                    productId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'zohoProducts'
                    },
                    designId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'newDesign'
                    },
                    quantity: {
                        type: Number,
                        default: 1
                    },
                    price: {
                        type: Number,
                        default: 0
                    }
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
            totalAmount: {
                default: 0,
                type: Number
            },
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
                default: "unplaced",
                enum: ["unplaced", "placed", "dispatched", "delivered"]
            },
            deliveryCharges: {
                type: Number,
                default: 0
            },
            paymentLink: String,
            paymentLinkId: String,
            CashfreeOrderId: String,
            printwearOrderId: String,
            shipRocketOrderId: String,
            shipmentId: String,
            customerOrderId: String,
            retailPrice: Number,
            createdAt: {
                type: mongoose.Schema.Types.Date,
                default: Date.now
            },
            deliveredOn: {
                type: mongoose.Schema.Types.Date
            },
            processed: {
                type: Boolean,
                default: false
            }
        }
    ]
});

var orderHistoryModel = mongoose.model("orderHistory", OrderHistorySchema);

module.exports = orderHistoryModel;