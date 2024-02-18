const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", false);

    return await mongoose.connect(process.env.MONGODB_URL);
    // return await mongoose.connect('mongodb://127.0.0.1:27017/printwear'); // test
    //  mongoose.connect("mongodb+srv://barath:987654321@cluster0.ooxe0gr.mongodb.net/?retryWrites=true&w=majority");
  }
  catch (e) {
    console.log(e);
    process.exit(1);
  }
}

module.exports = connectDB;