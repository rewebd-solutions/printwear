const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", false);

    // return await mongoose.connect('mongodb+srv://sit21it063:ifP2Q7QWXU4j3vFw@testcluster.2llp5qx.mongodb.net/?retryWrites=true&w=majority');
    //return await mongoose.connect('mongodb://127.0.0.1:27017/printwear'); // test
    return await mongoose.connect("mongodb+srv://barath:987654321@cluster0.ooxe0gr.mongodb.net/?retryWrites=true&w=majority");
  }
  catch (e) {
    console.log(e);
    process.exit(1);
  }
}

module.exports = connectDB;
