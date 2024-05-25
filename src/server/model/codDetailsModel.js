const mongoose = require("mongoose");

var CODSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  remittances: [
    {
      orderId: String,
      amount: Number,
      transferId: String,
      initiatedOn: {
        type: mongoose.Schema.Types.Date,
        default: Date.now,
      },
      completedOn: {
        type: mongoose.Schema.Types.Date,
      },
    },
  ],
  beneId: String,
});

const CODModel = mongoose.model("Cod", CODSchema);

module.exports = CODModel;
