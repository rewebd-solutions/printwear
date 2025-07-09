const { Schema, model } = require("mongoose");

const QuerySchema = new Schema({
    name: String,
    email: String,
    mobile: String,
    message: String,
    respondedOn: Schema.Types.Date
}, { timestamps: true });

const QueryModel = model("query", QuerySchema);

module.exports = QueryModel;