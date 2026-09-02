import { useState } from "react";
import { useRouter } from "expo-router";
import API from "../services/api";
import AuthShell from "../components/auth/AuthShell";
import AuthHero from "../components/auth/AuthHero";
import FormField from "../components/auth/FormField";
import PrimaryButton from "../components/auth/PrimaryButton";
import { Banner, BackLink } from "../components/auth/AuthBits";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      setError("Please enter your email");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    setError("");
    setLoading(true);
    try {
  await API.post("/auth/forgot-password", { email });

  router.push({
    pathname: "/(auth)/verify-otp",
    params: { email },
  });
} catch (err) {
  setError(
    err?.response?.data?.message ||
    "Unable to send OTP. Please try again."
  );
} finally {
  setLoading(false);
}
  };

  return (
    <AuthShell>
      <BackLink onPress={() => router.back()} />
      <AuthHero title="Forgot password?"
        subtitle="Enter your email and we'll send you a 6-digit code"
        size="compact"
      />

      <Banner text={error} />

      <FormField
        label="Email address"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />

      <PrimaryButton title="Send code" onPress={handleSendOtp} loading={loading} icon="paper-plane-outline" />
    </AuthShell>
  );
}
