import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";

// Shared visual shell for every auth-flow screen (Login, Register, Forgot
// Password, OTP, Reset, Health Profile) so they read as one consistent flow
// instead of five differently-styled screens.
export default function AuthShell({ children, scroll = true }) {
  const Content = scroll ? ScrollView : View;
  const contentProps = scroll
    ? { contentContainerStyle: styles.scroll, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: "handled" }
    : { style: styles.scroll };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Content {...contentProps}>{children}</Content>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, flexGrow: 1 },
  blobTop: {
    position: "absolute", top: -110, right: -90,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: COLORS.primaryDark + "0F",
  },
  blobBottom: {
    position: "absolute", bottom: -70, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: COLORS.primary + "0D",
  },
});
