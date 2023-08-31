const mongoose = require("mongoose");

const DesignSchema = mongoose.Schema({
    designName: {
        type: String
    },
    baseProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    color: String,
    size: String,
    designImage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: mongoose.Schema.Types.Date,
        default: Date.now
    }
});

const designModel = mongoose.model("Design", DesignSchema);

module.exports = designModel;