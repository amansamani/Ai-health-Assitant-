import React from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS, SPACING } from '../../constants/theme';

export default function AuthShell({ children, title, subtitle }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.brand}>
              <View style={styles.logoCircle}><Text style={styles.logoText}>F</Text></View>
              <Text style={styles.brandName}>Fitlip</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.titleBlock}>
              {title && <Text style={styles.title}>{title}</Text>}
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>{children}</Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  brand: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  logoText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  brandName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 1 },
  titleBlock: { marginBottom: SPACING.xl },
  title: { fontSize: 27, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 20 },
  form: { flex: 1 },
});
