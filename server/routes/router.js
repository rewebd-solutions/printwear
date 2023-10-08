const express = require('express')
const multer = require("multer");
const route = express.Router()
const services = require('../services/render')
const controller = require('../controller/controller');
const authServices = require("../services/auth");

const upload = multer({ storage: multer.memoryStorage() });

route.get('/', services.homeRoutes)

route.post('/register', controller.register);
route.post('/login', controller.login);
route.get('/login', authServices.authorizeLogin, services.loginpage);
route.get("/logout", controller.logout);

route.post('/uploadimage', authServices.authorizeToken, upload.single('image'), controller.uploadimage);
route.get("/obtainimages", authServices.authorizeToken, controller.obtainimages);
route.post("/deleteimage", authServices.authorizeToken, controller.deleteimage);

route.post('/addproduct', controller.addproduct); // adding a product by us, not user
route.get("/getproducts", controller.getproducts);// get request that retrieves all product info → for use in stock inventory
route.get("/getproduct/:id", controller.getproduct);

route.post("/adddesign", authServices.authorizeToken, controller.adddesign);
// route.get("/getdesigns", authServices.authorizeToken, controller.getdesigns);
route.post("/deletedesign", authServices.authorizeToken, controller.deletedesign);

route.post("/createdesign", authServices.authorizeToken, upload.array('images'), controller.createdesign);
route.get("/getdesigns", authServices.authorizeToken, controller.getdesigns);

route.get('/admin', services.adminpage); // it only has a form thats incomplete

route.get("/dashboard", authServices.authorizeToken, services.dashboardpage);
route.get("/productgallery", authServices.authorizeToken, services.productgallery); // user oda uploaded images kaatum
route.get("/manageorder", authServices.authorizeToken, services.manageorder); 
route.get("/placeorder", authServices.authorizeToken, services.placeorder);
route.get("/stock", authServices.authorizeToken, services.stock);
route.get("/connectstore", authServices.authorizeToken, services.connectstore);
route.get("/contact", authServices.authorizeToken, services.contact);
route.get("/designgenerator", authServices.authorizeToken, services.designgenerator);
route.get("/designlib", authServices.authorizeToken, services.designlib);
route.get("/invoice", authServices.authorizeToken, services.invoice);
route.get("/profile", authServices.authorizeToken, controller.profilepage);
// route.get("/mycart", authServices.authorizeToken, services.mycart);

// route.post("/addtocart", authServices.authorizeToken, controller.addtocart);
// route.get("/getcart", authServices.authorizeToken, controller.getcart);
// route.post("/deletecartitem", authServices.authorizeToken, controller.deletecartitem);

route.post("/createorder", authServices.authorizeToken, controller.createorder);

route.post("/createshiporder", controller.createshiporder);

route.get("/getshopifystock", authServices.authorizeToken, controller.getshopifystock);
route.get("/getshopifyorders", authServices.authorizeToken, controller.getshopifyorders);

route.post("/connect-shopify", authServices.authorizeToken, controller.connectShopify);
route.post("/connect-woocommerce", authServices.authorizeToken, controller.connectWooCommerce);

route.get("/getzohoproducts", controller.getZohoProducts);
// route.get("/getzohoproductgroups", controller.getZohoProductGroups);

route.post("/createshopifyproduct", authServices.authorizeToken, controller.createshopifyproduct);
route.post("/createwoocommerceorder", authServices.authorizeToken, controller.createwoocommerceorder);

// route.get("/createzohoproducts", controller.createZohoProducts);

module.exports = route