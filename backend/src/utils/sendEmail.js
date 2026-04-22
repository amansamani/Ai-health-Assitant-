const { Resend } = require("resend");

const sendEmail = async (to, otp) => {
  const resend = new Resend(process.env.RESEND_API_KEY); // ✅ inside function

  await resend.emails.send({
    from: "FitLip <onboarding@resend.dev>",
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>Expires in 10 minutes.</p>`,
  });
};

module.exports = sendEmail;