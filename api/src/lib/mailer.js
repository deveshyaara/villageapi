import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a transactional email.
 * @param {{ to: string, subject: string, html: string }} opts
 */
export async function sendMail({ to, subject, html }) {
  const info = await transporter.sendMail({
    from: `"VillageAPI" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  console.log(`[Mailer] Sent "${subject}" to ${to} — messageId: ${info.messageId}`);
  return info;
}

export default transporter;
