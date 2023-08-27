const mongoose = require("mongoose");

const ImageSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    front: String,
    back: String
});

const imageModel = mongoose.model("Image", ImageSchema);

module.exports = imageModel;