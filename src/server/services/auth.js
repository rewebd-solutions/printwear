const jwt = require("jsonwebtoken");

exports.createToken = (userId, userName) => {
    const token = jwt.sign({
        id: userId,
        name: userName,
    }, "thatsasecret", { expiresIn: "1d"} );
    return token;
}

exports.authorizeToken = (req, res, next) => {
    // console.log("cooks", req.cookies);
    const token = req.cookies.actk;
    // console.log(token);
    if (!token) {
      return res.redirect("/login");
    }
    try {
      const data = jwt.verify(token, "thatsasecret");
      // console.log(data);
      req.userId = data.id;
      req.userName = data.name;
      return next();
    } catch {
      res.clearCookie("actk");
      return res.redirect("/login");
    }
};

exports.authorizeLogin = (req, res, next) => {
    const token = req.cookies.actk;
    if (token) return res.redirect("/dashboard");
    return next();
}

exports.decryptToken = (req, res, next) => {
  try {
    const data = jwt.verify(req.cookies.actk, "thatsasecret");
    req.name = data.name;
    return next();
  } catch (error) {
    return next();
  }
}