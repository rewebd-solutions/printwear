const mongoose = require("mongoose");

const LabelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    labels: [
        {
            name: String,
            URL: String
        }
    ]
})

const LabelModel = mongoose.model("labels", LabelSchema);

module.exports = LabelModel;