const mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: Number,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    emailVerified: {
        type: Boolean,
        required: true
    },
    phoneVerified: {
        type: Boolean,
        required: true
    },
    cartId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: false
    },
    image: {
        data: Buffer,
        contentType: String
    }
})

const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;