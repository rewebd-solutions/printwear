const mongoose = require('mongoose');

var ProductSchema = new mongoose.Schema({
    SKU: String,
    name: String,
    category: String,
    gender: String,
    description: String,
    productImage: {
        front: String,
        back: String
    },
    // sizes: [String], 
    colors: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Color',
        }
    ],
    price: {
        xs: Number,
        s: Number,
        m: Number,
        l: Number,
        xl: Number,
    },
    canvas: {
        front: {
            startX: Number,
            startY: Number,
            width: Number,
            height: Number
        },
        back: {
            startX: Number,
            startY: Number,
            width: Number,
            height: Number
        }
    }
});

const productModel = mongoose.model('Product', ProductSchema);

module.exports = productModel;