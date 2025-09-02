const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set("strictQuery", false);
    return await mongoose.connect(process.env.MONGODB_URL);
  }
  catch (e) {
    console.log(e);
    process.exit(1);
  }
}

module.exports = connectDB;