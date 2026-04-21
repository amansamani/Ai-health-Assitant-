const nodemailer = require("nodemailer");

const sendEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,       // your gmail
    pass: process.env.EMAIL_PASS,       // 16-char App Password, NOT your real password
  },
});

  await transporter.sendMail({
    from: `"FitLip" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${otp}</h2>`,
  });
};

module.exports = sendEmail;