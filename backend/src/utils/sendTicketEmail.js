const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendTicketEmail(toEmail, ticketId, qrBase64, details = {}) {
  if (!toEmail) throw new Error("Recipient email missing");

  const eventName = details.eventName ? String(details.eventName) : "";
  const participantName = details.participantName
    ? String(details.participantName)
    : "";
  const participantEmail = details.participantEmail
    ? String(details.participantEmail)
    : "";

  await transporter.sendMail({
    from: `"Felicity Events" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Event Ticket",
    html: `
    <h2>Registration Successful</h2>
    ${eventName ? `<p><b>Event:</b> ${eventName}</p>` : ""}
    ${participantName ? `<p><b>Participant:</b> ${participantName}</p>` : ""}
    ${participantEmail ? `<p><b>Email:</b> ${participantEmail}</p>` : ""}
    <p><b>Ticket ID:</b> ${ticketId}</p>
    <img src="cid:qr-code"/>
  `,
    attachments: [
      {
        filename: "ticket-qr.png",
        content: qrBase64.split("base64,")[1],
        encoding: "base64",
        cid: "qr-code",
      },
    ],
  });
}

module.exports = sendTicketEmail;
