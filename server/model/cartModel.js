const mongoose = require("mongoose");

var CartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    items: [
        {
            design: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Design'
            },
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },  
            quantity: {
                XS: Number,
                S: Number,
                M: Number,
                L: Number,
                XL: Number,
            },
            address: String,
            price: Number
        }
    ],
    totalAmount: Number,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

const cartModel = mongoose.model('Cart', CartSchema);

module.exports = cartModel;