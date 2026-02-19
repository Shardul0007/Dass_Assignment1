const jwt = require("jsonwebtoken");

const authmiddleware = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.split(" ")[1];
    const decoded_token = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded_token.userId,
      role: decoded_token.role,
    };

    next();
  } catch (err) {
    console.log(err);
    res.status(401).json({ message: "Unauthorized" });
  }
};

const adminmiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const organizermiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "organizer") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const participantmiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "participant") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

module.exports = {
  authmiddleware,
  adminmiddleware,
  organizermiddleware,
  participantmiddleware,
};
