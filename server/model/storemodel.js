const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
    // _id: mongoose.Schema.Types.ObjectId, 
    userid: { type: String, required: true },
    shopifyStores: [
        {
            shopName: { type: String },
            shopifyAccessToken: { type: String },
            shopifyStoreURL: { type: String }
        },
    ],
    wooCommerceStores: [
        {
            shopName: { type: String },
            url: { type: String},
            consumerKey: { type: String },
            consumerSecret: { type: String}
        },
    ]
});

const StoreModel = mongoose.model('Store', StoreSchema);

module.exports = StoreModel;
