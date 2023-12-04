const mongoose = require("mongoose");

const LabelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    labels: [
        {
            name: String,
            url: String
        }
    ]
})

const LabelModel = mongoose.model("labels", LabelSchema);

module.exports = LabelModel;