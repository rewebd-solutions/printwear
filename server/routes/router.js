const express = require('express')
const route = express.Router()
const services = require('../services/render')
const controller = require('../controller/controller');
route.get('/', services.homeRoutes)

route.post('/register', controller.register);
route.post('/login', controller.login);
route.get('/login', services.loginpage);

route.get("/dashboard", services.dashboardpage);

route.post('/emailverify', controller.emailverify);
route.post('/sendingotp', controller.sendotp);
route.get('/forget', services.forgetRoutes);

route.post('/verify', controller.verify);
route.post('/updatepassword', controller.updatepassword);
route.post('/upload', controller.upload);

route.get('/admin', services.adminpage); // it only has a form thats incomplete
route.post('/addproduct', controller.addproduct);
route.get("/displayproduct", controller.displayproduct);
route.get("/designgallery", services.designgallery);
route.get("/connectstore", services.connectstore);
route.get("/contact", services.contact);
route.get("/mockupgenerator", services.mockupgenerator);

route.get('/cart/:id', controller.addtocartitems);
route.get('/cart', controller.showCartItems);
route.post('/update/:id', controller.update);
route.get('/cart_item_del/:id', controller.cart_item_del);
route.get('/cart_clone/:id', controller.cart_clone);
route.post('/my-endpoint', controller.addtocartMock);

route.post("/connect-shopify", controller.connectShopify);
route.post("/connect-woocommerce", controller.connectWooCommerce);

module.exports = route