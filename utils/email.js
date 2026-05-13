const nodemailer = require("nodemailer");

/**
 * Create reusable transporter
 */
const createTransporter = () => {
  const port = Number(process.env.EMAIL_PORT);

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Verify SMTP connection once at startup
  transporter.verify((err, success) => {
    if (err) {
      console.log("❌ SMTP connection failed:", err.message);
    } else {
      console.log("✅ SMTP server is ready");
    }
  });

  return transporter;
};

const transporter = createTransporter();

/**
 * Send OTP Email
 */
const sendOtpEmail = async (toEmail, otp, userName = "User") => {
  if (!toEmail || !otp) {
    throw new Error("Missing email or OTP");
  }

  const mailOptions = {
    from: `"Elysian Support" <${process.env.EMAIL_USERNAME}>`,
    to: toEmail,
    subject: "Your Verification OTP",
    text: `
Hi ${userName},

Your OTP is: ${otp}

It expires in 10 minutes. Do not share it with anyone.

If you did not request this, ignore this email.
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
        
        <h2 style="color: #111827;">Email Verification</h2>

        <p style="color: #6b7280;">
          Hi <strong>${userName}</strong>, use the OTP below to complete verification.
        </p>

        <div style="text-align:center; margin: 30px 0;">
          <div style="
            display: inline-block;
            font-size: 34px;
            letter-spacing: 10px;
            font-weight: bold;
            color: #4f46e5;
            background: #eef2ff;
            padding: 14px 26px;
            border-radius: 8px;
          ">
            ${otp}
          </div>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          ⏱ This OTP expires in <strong>10 minutes</strong>.
        </p>

        <p style="color: #6b7280; font-size: 14px;">
          🔒 Do not share this OTP with anyone.
        </p>

        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />

        <p style="color: #9ca3af; font-size: 12px;">
          If you didn’t request this, you can ignore this email safely.
        </p>

      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ OTP email sent successfully");
    console.log("Message ID:", info.messageId);

    return info;
  } catch (error) {
    console.log("❌ Failed to send OTP email:", error.message);
    throw new Error("Email sending failed");
  }
};

module.exports = { sendOtpEmail };
