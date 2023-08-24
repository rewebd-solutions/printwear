const mongoose = require('mongoose');

const connectDB=async()=>{
    try{
        mongoose.set("strictQuery", false);

        mongoose.connect("mongodb://127.0.0.1:27017/BARATH");
      //  mongoose.connect("mongodb+srv://barath:987654321@cluster0.ooxe0gr.mongodb.net/?retryWrites=true&w=majority");

  console.log("Connected to MongoDB");
       

   }
   catch(e){
     console.log(e);
     process.exit(1);
   }
}

module.exports=connectDB;