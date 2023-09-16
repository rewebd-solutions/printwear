const jwt = require("jsonwebtoken");

exports.createToken = (userId) => {
    const token = jwt.sign({
        id: userId,
    }, "thatsasecret", { expiresIn: "6h"} );
    return token;
}

exports.authorizeToken = (req, res, next) => {
    // console.log("cooks", req.cookies);
    const token = req.cookies.actk;
    // console.log(token);
    if (!token) {
      return res.render("expired");
    }
    try {
      const data = jwt.verify(token, "thatsasecret");
      // console.log(data);
      req.userId = data.id;
      return next();
    } catch {
      res.clearCookie("actk");
      return res.render("expired");
    }
};

exports.authorizeLogin = (req, res, next) => {
    const token = req.cookies.actk;
    if (token) return res.redirect("/dashboard");
    return next();
}
