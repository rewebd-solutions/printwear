const mongoose = require("mongoose");

const ImageSchema = mongoose.Schema({
    front: String,
    back: String
});

const imageModel = mongoose.model("Image", ImageSchema);

module.exports = imageModel;