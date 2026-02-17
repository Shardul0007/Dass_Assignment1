const nodemailer = require("nodemailer");

const bool = (v) => String(v || "").toLowerCase() === "true";

const getFromAddress = () =>
  process.env.EMAIL_FROM ||
  (process.env.EMAIL_USER ? `"Felicity Events" <${process.env.EMAIL_USER}>` : undefined);

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = bool(process.env.SMTP_SECURE) || port === 465;

  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const passRaw = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const pass = String(passRaw || "").replace(/\s+/g, "");

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  };
};

const smtpConfig = getSmtpConfig();

const transporter = nodemailer.createTransport({
  ...smtpConfig,
  pool: true,
  maxConnections: 2,
  maxMessages: 100,
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
  logger: bool(process.env.MAIL_DEBUG),
  debug: bool(process.env.MAIL_DEBUG),
  tls: {
    // Keeps things compatible across hosted environments.
    // If you want strict TLS checks, set SMTP_REJECT_UNAUTHORIZED=true.
    rejectUnauthorized: bool(process.env.SMTP_REJECT_UNAUTHORIZED),
  },
});

// Verify SMTP connectivity on boot (non-blocking)
(async () => {
  try {
    if (!smtpConfig.auth) {
      console.log("SMTP not configured (missing SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS)");
      return;
    }
    await transporter.verify();
    console.log("SMTP verify ok:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth?.user,
    });
  } catch (err) {
    console.log("SMTP verify failed:", {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      message: err?.message,
      code: err?.code,
      response: err?.response,
      responseCode: err?.responseCode,
      command: err?.command,
    });
  }
})();

const sendViaResend = async ({ to, subject, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const from = process.env.RESEND_FROM || getFromAddress();
  if (!from) throw new Error("Missing from address (set EMAIL_USER or RESEND_FROM)");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  const payloadText = await res.text();
  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = { raw: payloadText };
  }

  if (!res.ok) {
    const msg = payload?.message || payload?.error || payloadText || "Resend error";
    const e = new Error(String(msg));
    e.status = res.status;
    e.payload = payload;
    throw e;
  }

  console.log("Resend email sent:", { to, id: payload?.id });
  return payload;
};

const isNetworkTimeout = (err) => {
  const code = String(err?.code || "").toUpperCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    msg.includes("connection timeout")
  );
};

const sendEmail = async ({ to, subject, html, attachments }) => {
  const from = getFromAddress();

  if (smtpConfig.auth) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments,
      });
      return { provider: "smtp", info };
    } catch (err) {
      console.log("SMTP send failed:", {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        message: err?.message,
        code: err?.code,
        response: err?.response,
        responseCode: err?.responseCode,
        command: err?.command,
      });

      if (isNetworkTimeout(err) && process.env.RESEND_API_KEY) {
        const resendPayload = await sendViaResend({ to, subject, html });
        return { provider: "resend", info: resendPayload };
      }

      throw err;
    }
  }

  if (process.env.RESEND_API_KEY) {
    const resendPayload = await sendViaResend({ to, subject, html });
    return { provider: "resend", info: resendPayload };
  }

  throw new Error(
    "No email provider configured. Set EMAIL_USER/EMAIL_PASS (SMTP) or RESEND_API_KEY.",
  );
};

module.exports = {
  sendEmail,
  getFromAddress,
};
