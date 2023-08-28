const mongoose = require("mongoose");

const ImageSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    front: {
        url: String,
        name: String,
        size: Number,
        format: String
    },
    back: {
        url: String,
        name: String,
        size: Number,
        format: String
    },
});

const imageModel = mongoose.model("Image", ImageSchema);

module.exports = imageModel;