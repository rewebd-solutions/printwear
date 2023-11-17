const mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
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
      ref: 'Cart'
    },
    billingAddress: {
      firstName: {
        type: String
      },
      lastName: {
        type: String
      },
      street: {
        type: String
      },
      city: {
        type: String
      },
      landmark: {
        type: String
      },
      state: {
        type: String
      },
      pincode: {
        type: Number,
      }
    },
    shippingAddress: {
      firstName: {
        type: String
      },
      lastName: {
        type: String
      },
      street: {
        type: String
      },
      city: {
        type: String
      },
      landmark: {
        type: String
      },
      state: {
        type: String
      },
      pincode: {
        type: Number
      }
    },
    profileImage: {
      type: String
    },
    brandName: String
})

const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;