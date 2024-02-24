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
      default: false
    },
    phoneVerified: {
      type: Boolean,
      default: false
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
      },
      phone: String
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
      },
      phone: String
    },
    profileImage: {
      type: String
    },
    brandName: String,
    isZohoCustomer: {
      type: Boolean,
      default: false
    },
    zohoCustomerID: String,
    zohoContactID: String,
    wooCustomerId: String,
    wooUserId: String,
    dateJoined: {
      type: mongoose.Schema.Types.Date,
      default: Date.now
    }
})

const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;