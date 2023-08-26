const mongoose = require('mongoose');

var ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  quantity: Number,
  frontimage: String,
  backimage: String,
  fronttext: String,
  backtext: String
});

const productModel = mongoose.model('Product', ProductSchema);

module.exports = productModel;