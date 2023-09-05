
exports.homeRoutes = (req, res) => {
    res.render("index");
    //res.sendFile(__dirname+'/mockup.html');
}

exports.loginpage = (req, res) => {
    // if (req.id) return res.redirect("/dashboard");
    res.render("login", { status: '' });
}

exports.expired = (req, res) => {
    res.render("expired");
}

exports.dashboardpage = (req, res) => {
    res.render("dashboard");
}

exports.adminpage = (req, res) => {
    res.render("admin");
}

exports.forgetRoutes = (req, res) => {
    res.render('forgetpassword', { success: "" });
}

exports.productgallery = (req, res) => {
    res.render('productgallery', { status: "" });
}

exports.placeorder = (req, res) => {
    res.render("placeorder");
}

exports.manageorder = (req, res) => {
    res.render("manageorder");
}

exports.stock = (req, res) => {
    res.render("stock", { value: 1});
}

exports.mycart = (req, res) => {
    res.render("cart");
}

exports.invoice = (req, res) => {
    res.render("invoice");
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
    res.render('designgenerator');
}
