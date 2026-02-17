const { sendEmail } = require("./mailer");

const sendPasswordResetEmail = async ({ to, subject, html }) => {
  const { provider, info } = await sendEmail({ to, subject, html });

  console.log("Password reset email sent:", {
    to,
    provider,
    messageId: info?.messageId,
    response: info?.response,
  });

  return info;
};

module.exports = {
  sendPasswordResetEmail,
};
