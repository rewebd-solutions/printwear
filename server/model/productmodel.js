const mongoose=require('mongoose');

var productSchema = mongoose.Schema({
    name: String,
    price: Number,
    quantity:Number,
    frontimage: String,
    backimage: String,
    fronttext: String,
    backtext: String
  });
  
const Product = mongoose.model('Product', productSchema);

module.exports=Product;