const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", false);

    // return await mongoose.connect(process.env.MONGODB_URL);
    // return await mongoose.connect('mongodb://127.0.0.1:27017/printwear'); // test
    mongoose.connect("mongodb+srv://gowtham9112006:2gp9cGtAcCdmmJWv@printwearcluster.mfoufe8.mongodb.net/?retryWrites=true&w=majority&appName=printwearcluster");
  }
  catch (e) {
    console.log(e);
    process.exit(1);
  }
}

module.exports = connectDB;