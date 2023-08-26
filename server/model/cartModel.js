const mongoose = require("mongoose");

var CartSchema = new mongoose.Schema({
    name: String,
    price: Number,
    S: Number,
    M: Number,
    L: Number,
    XL: Number,
    XXL: Number,
    address: String,
    Frontimage: String,
    Backimage: String,
});

const cartModel = mongoose.model('Cart', CartSchema);

module.exports = cartModel;