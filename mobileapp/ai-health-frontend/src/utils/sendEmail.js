const nodemailer = require("nodemailer");

const sendEmail = async (toEmail, otp) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"FitLip App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Password Reset OTP",
    html: `
      <div style="font-family: Arial; max-width: 400px; margin: auto; padding: 20px; border-radius: 10px; border: 1px solid #eee;">
        <h2 style="color: #6366F1;">FitLip Password Reset</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 8px; color: #6366F1;">${otp}</h1>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `,
  });
};

module.exports = sendEmail;