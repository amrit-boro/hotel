const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  console.log("1. Create Transporter..."); // <--- DEBUG LOG

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: '"Elysian Support" <support@elysian.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  console.log("2. Sending Mail now..."); // <--- DEBUG LOG

  try {
    await transporter.sendMail(mailOptions);
    console.log("3. Mail Sent Successfully!"); // <--- DEBUG LOG
  } catch (error) {
    console.log("❌ Error in Nodemailer:", error); // <--- SEE THE ERROR
    throw error; // Throw it so the Controller catches it
  }
};

module.exports = sendEmail;
