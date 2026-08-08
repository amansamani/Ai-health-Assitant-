import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function FormField({ label, icon, secureTextEntry = false, error, ...props }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrap, focused && { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceElevated }]}>
        {icon && <Ionicons name={icon} size={18} color={focused ? COLORS.primary : COLORS.textTertiary} style={styles.icon} />}
        <TextInput
          {...props}
          style={styles.input}
          placeholderTextColor={COLORS.textTertiary}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.md },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md, height: 52,
  },
  icon: { marginRight: SPACING.sm },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  eyeBtn: { padding: SPACING.xs },
  error: { fontSize: 12, color: COLORS.danger, marginTop: SPACING.xs },
});
