const nodemailer = require("nodemailer");

const sendEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
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