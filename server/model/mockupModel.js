const mongoose = require("mongoose");

var MockupSchema = new mongoose.Schema({
    name: String,
    description: String,
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ZohoProducts'
    },
    image: String,
    canvas: {
        width: Number,
        height: Number,
        top: Number,
        left: Number,
        rot: Number,
    }
});

const MockupModel = mongoose.model('Mockup', MockupSchema);

module.exports = MockupModel;