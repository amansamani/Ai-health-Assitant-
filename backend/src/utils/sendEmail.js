const nodemailer = require("nodemailer");

const sendEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",  // ✅ explicit host
    port: 587,               // ✅ 587 instead of 465
    secure: false,           // ✅ false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"FitLip" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>This OTP expires in 10 minutes.</p>`,
  });
};

module.exports = sendEmail;