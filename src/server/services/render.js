
exports.homeRoutes = (req, res) => {
    res.render("index");
    //res.sendFile(__dirname+'/mockup.html');
}

exports.contactus = (req, res) => {
    res.render("contactus");
}

exports.privacypolicy = (req, res) => {
    res.render("privacypolicy");
}

exports.aboutus = (req, res) => {
    res.render("aboutus");
}

exports.termsandconditions = (req, res) => {
    res.render("termsandconditions");
}

exports.faql = (req, res) => {
    res.render("faql");
}

exports.shipandrefund = (req, res) => {
    res.render("shipandrefund");
}

exports.loginpage = (req, res) => {
    // if (req.id) return res.redirect("/dashboard");
    res.render("login", { data: {error: false} });
}

exports.resetpassword = (req, res) => {
    res.render("resetpassword", { data: { error: false } });
}

exports.adminpage = (req, res) => {
    res.render("admin");
}

exports.admindash = (req, res) => {
    res.render("admindashboard");
}

exports.adminorder = (req, res) => {
    res.render("adminorder");
}

exports.adminusers = (req, res) => {
    res.render("adminusers");
}

exports.forgetRoutes = (req, res) => {
    res.render('forgetpassword', { success: "" });
}

exports.productgallery = (req, res) => {
    res.render('productgallery');
}

exports.mockupgenerator = (req, res) => {
    res.render("mockupgenerator", { userName: req.userName });
}

exports.placeorder = (req, res) => {
    res.render("placeorder");
}

exports.manageorder = (req, res) => {
    res.render("manageorder");
}

exports.stock = (req, res) => {
    res.render("stock");
}

exports.mycart = (req, res) => {
    res.render("cart");
}

exports.designlib = (req, res) => {
    res.render("designlib");
}

exports.connectstore = (req, res) => {
    res.render('connectstore',  { status: ''});
}
exports.contact = (req, res) => {
    res.render("contact");
}

exports.designgenerator = (req, res) => {
    res.render('designgenerator', { userName: req.userName });
}

exports.success = (req, res) => {
    const { type } = req.query;
    res.render('payment-success', { type });
}

exports.mystores = (req, res) => {
    res.render("storeorder");
}