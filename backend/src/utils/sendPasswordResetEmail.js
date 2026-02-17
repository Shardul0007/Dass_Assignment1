const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    // Gmail "App Password" is often displayed with spaces; nodemailer expects it without.
    pass: String(process.env.EMAIL_PASS || "").replace(/\s+/g, ""),
  },
});

const sendPasswordResetEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"Felicity Events" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = {
  sendPasswordResetEmail,
};
