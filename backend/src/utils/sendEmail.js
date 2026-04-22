const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, otp) => {
  await resend.emails.send({
    from: "FitLip <onboarding@resend.dev>", // ✅ works without domain verification
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>Expires in 10 minutes.</p>`,
  });
};

module.exports = sendEmail;