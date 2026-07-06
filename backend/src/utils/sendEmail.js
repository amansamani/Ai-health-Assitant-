const { Resend } = require("resend");
const logger = require("../config/logger");

const sendEmail = async (to, otp) => {
  logger.debug({ hasResendKey: !!process.env.RESEND_API_KEY }, "Sending OTP email");

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "FitLip <noreply@amansamani.me>",
    to,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: <strong>${otp}</strong></h2><p>Expires in 10 minutes.</p>`,
  });
};

module.exports = sendEmail;