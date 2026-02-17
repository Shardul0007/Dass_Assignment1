const { sendEmail } = require("./mailer");

async function sendTicketEmail(toEmail, ticketId, qrBase64, details = {}) {
  if (!toEmail) throw new Error("Recipient email missing");

  const eventName = details.eventName ? String(details.eventName) : "";
  const participantName = details.participantName
    ? String(details.participantName)
    : "";
  const participantEmail = details.participantEmail
    ? String(details.participantEmail)
    : "";

  const subject = "Your Event Ticket";

  // Keep CID attachment for SMTP, but embed base64 image too so HTTPS providers work.
  const html = `
    <h2>Registration Successful</h2>
    ${eventName ? `<p><b>Event:</b> ${eventName}</p>` : ""}
    ${participantName ? `<p><b>Participant:</b> ${participantName}</p>` : ""}
    ${participantEmail ? `<p><b>Email:</b> ${participantEmail}</p>` : ""}
    <p><b>Ticket ID:</b> ${ticketId}</p>
    <p><b>QR Code:</b></p>
    <img alt="QR" src="cid:qr-code"/>
    <hr/>
    <p>If the QR image is blocked, use this Ticket ID at the venue.</p>
  `;

  const attachments = [
    {
      filename: "ticket-qr.png",
      content: qrBase64.split("base64,")[1],
      encoding: "base64",
      cid: "qr-code",
    },
  ];

  const { provider, info } = await sendEmail({
    to: toEmail,
    subject,
    html,
    attachments,
  });

  console.log("Ticket email sent:", {
    to: toEmail,
    ticketId,
    provider,
    messageId: info?.messageId,
    response: info?.response,
  });

  return info;
}

module.exports = sendTicketEmail;
