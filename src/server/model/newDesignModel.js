const mongoose = require("mongoose");

var NewDesignSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    designs: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'zohoProducts'
            },
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
            backPrice: Number,
            frontPrice: Number,
            designDimensions: {
                width: Number,
                height: Number,
                top: Number,
                left: Number,
            },
            backDesignDimensions: {
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
            ],
            neckLabel: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'labels',
            },
            isAddedToShopify: {
                type: Boolean,
                default: false
            },
            isAddedToWoocommerce: {
                type: Boolean,
                default: false
            },
            isMigrated: {
                type: Boolean,
                default: false
            },
            wooProductId: String,
            wooVariationId: String
        }
    ],
});

const newDesignModel = mongoose.model("NewDesign", NewDesignSchema);

module.exports = newDesignModel;