const mongoose = require('mongoose');

const ColorSchema = new mongoose.Schema({
    colorName: String,
    colorSKU: String,
    colorCode: String,
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    colorImage: {
        front: String,
        back: String
    },
    sizes: [
        {   
            sizeSKU: String,
            size: String,
            stock: Number
        }
    ]
});

const colorModel = mongoose.model('Color', ColorSchema);

module.exports = colorModel;
