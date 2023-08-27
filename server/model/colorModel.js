const mongoose = require('mongoose');

const ColorSchema = new mongoose.Schema({
    colorName: String,
    sizes: [
        {
            size: String,
            stock: Number
        }
    ]
});

const colorModel = mongoose.model('Color', ColorSchema);

module.exports = colorModel;
