const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    images: [
        {
            url: String,
            name: String,
            size: Number,
            format: String,
            isWooDeleted: Boolean
        }
    ]
});

const imageModel = mongoose.model("Image", ImageSchema);

module.exports = imageModel;