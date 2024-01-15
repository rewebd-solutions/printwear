const { Schema, model } = require("mongoose");

var WalletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    transactions: [
        {
            transactionType: {
                type: String,
                enum: ["recharge", "payment"],
                required: true,
            },
            amount: {
                type: Number,
                required: true,
                min: 0,
            },
            transactionDate: {
                type: Schema.Types.Date,
                default: Date.now,
            },
            invoiceURL: {
                type: String
            },
            cashfreeOrderId: String,
            walletOrderId: String,
            cashfreeSessionId: String,
            transactionStatus: {
                type: String,
                enum: ["pending", "success", "failed", "refund_init", "refunded"]
            },
            refundAmount: Number
        }
    ]
});

WalletSchema.index({ userId: 1 });

const WalletModel = model('Wallet', WalletSchema);

module.exports = WalletModel;