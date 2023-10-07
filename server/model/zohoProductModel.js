const mongoose = require("mongoose");

var ZohoProductSchema = new mongoose.Schema({
      "style": String,
      "brand": String,
      "manufacturer": String,
      "description": String,
      "group": String,
      "baseImage": {
        "front": String,
        "back": String
      },
      "colors": {
        $dynamicColor: {
          "frontImage": String,
          "backImage": String,
          "colorCode": String,
          "sizes": {
            $dynamicSize: {
              "id": String,
              "name": String,
              "stock": Number,
              "price": Number,
              "sku": String,
              "dimensions": {
                "length": Number,
                "chest": Number,
                "sleeve": Number,
                "weight": Number
              }
            }
          }
        }
      },
      "canvas": {
        "front": {
          "startX": Number,
          "startY": Number,
          "width": Number,
          "height": Number
        },
        "back": {
          "startX": Number,
          "startY": Number,
          "width": Number,
          "height": Number
        }
      }
  }, { strict: false });

const ZohoProductModel = mongoose.model("ZohoProducts", ZohoProductSchema);

module.exports = ZohoProductModel;