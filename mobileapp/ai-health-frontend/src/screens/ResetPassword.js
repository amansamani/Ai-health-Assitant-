import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import API from "../services/api";
import AuthShell from "../components/auth/AuthShell";
import AuthHero from "../components/auth/AuthHero";
import FormField from "../components/auth/FormField";
import PrimaryButton from "../components/auth/PrimaryButton";
import { Banner, BackLink } from "../components/auth/AuthBits";

export default function ResetPassword() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!newPassword || !confirmPass) {
      setError("Please fill in both fields");
      return;
    }
    if (newPassword !== confirmPass) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await API.post("/auth/reset-password", { email, newPassword });
      router.replace({ pathname: "/(auth)/login", params: { justReset: "1" } });
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <BackLink onPress={() => router.back()} />
      <AuthHero
        icon="lock-closed-outline"
        title="New password"
        subtitle="Make it at least 6 characters"
        size="compact"
      />

      <Banner text={error} />

      <FormField
        label="New password"
        icon="lock-closed-outline"
        placeholder="Enter new password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      <FormField
        label="Confirm password"
        icon="lock-closed-outline"
        placeholder="Re-enter new password"
        value={confirmPass}
        onChangeText={setConfirmPass}
        secureTextEntry
      />

      <PrimaryButton title="Reset password" onPress={handleReset} loading={loading} icon="checkmark" />
    </AuthShell>
  );
}
