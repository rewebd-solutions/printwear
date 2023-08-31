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
            quantity: Number,
            address: String,
            price: Number
        }
    ]
});

const cartModel = mongoose.model('Cart', CartSchema);

module.exports = cartModel;