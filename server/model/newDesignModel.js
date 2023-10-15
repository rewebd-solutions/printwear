const mongoose = require("mongoose");

var NewDesignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    designs: [
        {
            product: {
                id: String,
                name: String,
                style: String,
                color: String,
                hex: String,
                size: String,
                SKU: String,
                price: Number,
                baseImage: {
                    front: String,
                    back: String,
                },
                dimensions: {
                    length: Number,
                    chest: Number,
                    sleeve: Number,
                    weight: Number
                }
            },
            designSKU: String,
            designName: String,
            price: Number,
            designDimensions: {
                width: Number,
                height: Number,
                top: Number,
                left: Number,
            },
            designImage: {
                front: String,
                back: String
            },
            designItems: [
                {
                    itemName: String,
                    URL: String
                }
            ]
        }
    ]
});

const newDesignModel = mongoose.model("NewDesign", NewDesignSchema);

module.exports = newDesignModel;