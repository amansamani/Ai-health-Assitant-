"use strict";
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../constants/theme';

function MacroBox({ label, value, unit, color }) {
  return (
    <View style={styles.macroBox}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{value}<Text style={styles.macroUnit}> {unit}</Text></Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

export default function LogMealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  let food = {};
  try { food = JSON.parse(params.food || '{}'); } catch (e) {}
  const mealType = params.mealType || 'breakfast';

  const [quantity, setQuantity] = useState(food?.quantity || 100);
  const [loading, setLoading] = useState(false);

  const baseQty = food?.quantity || 100;
  const scale = quantity / baseQty;
  const cal = Math.round((food?.calories || 0) * scale);
  const pro = Math.round((food?.protein || 0) * scale);
  const carb = Math.round((food?.carbs || 0) * scale);
  const fat = Math.round((food?.fats || 0) * scale);

  const handleLog = async () => {
    setLoading(true);
    try {
      await API.post('/nutrition/log-meal', {
        mealType,
        food: { name: food?.name || 'Unknown', brand: food?.brand || '', quantity, unit: food?.unit || 'g', calories: cal, protein: pro, carbs: carb, fats: fat },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Logged! 🎉', `${food?.name} added to ${mealType}.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('Error', 'Could not log meal. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Meal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(80)} style={styles.foodCard}>
          <View style={styles.foodIconWrap}><Text style={{ fontSize: 32 }}>{food?.emoji || '🍽️'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{food?.name || 'Food Item'}</Text>
            <Text style={styles.foodBrand}>{food?.brand || 'Generic'}</Text>
            <View style={styles.mealTypeBadge}><Text style={styles.mealTypeText}>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</Text></View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.stepperRow}>
            <Text style={styles.stepperLabel}>Amount</Text>
            <View style={styles.stepperControls}>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setQuantity(Math.max(0, quantity - 10))}><Ionicons name="remove" size={18} color={COLORS.textSecondary} /></TouchableOpacity>
              <View style={styles.stepperValue}><Text style={styles.stepperText}>{quantity}</Text><Text style={styles.stepperUnit}>{food?.unit || 'g'}</Text></View>
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setQuantity(quantity + 10)}><Ionicons name="add" size={18} color={COLORS.textSecondary} /></TouchableOpacity>
            </View>
          </View>
          <View style={styles.presetRow}>
            {[50, 100, 150, 200, 250].map(v => (
              <TouchableOpacity key={v} style={[styles.presetChip, quantity === v && styles.presetChipActive]} onPress={() => { setQuantity(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Text style={[styles.presetText, quantity === v && { color: '#fff' }]}>{v}g</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240)} style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition (scaled)</Text>
          <View style={styles.macroGrid}>
            <MacroBox label="Calories" value={cal} unit="kcal" color={COLORS.primary} />
            <MacroBox label="Protein" value={pro} unit="g" color={COLORS.secondary} />
            <MacroBox label="Carbs" value={carb} unit="g" color={COLORS.warning} />
            <MacroBox label="Fats" value={fat} unit="g" color={COLORS.danger} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(320)}>
          <TouchableOpacity style={[styles.logBtn, loading && { opacity: 0.7 }]} onPress={handleLog} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <><Ionicons name="add-circle" size={20} color="#fff" /><Text style={styles.logBtnText}>Log {food?.name || 'Meal'}</Text></>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 60 },
  foodCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.sm },
  foodIconWrap: { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  foodName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  foodBrand: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  mealTypeBadge: { alignSelf: 'flex-start', marginTop: SPACING.sm, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  mealTypeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  stepperLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepperBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { flexDirection: 'row', alignItems: 'baseline', gap: 2, minWidth: 60, justifyContent: 'center' },
  stepperText: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  stepperUnit: { fontSize: 12, color: COLORS.textTertiary },
  presetRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  presetChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  presetChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  presetText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  macroBox: { width: '47%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: SPACING.sm },
  macroValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  macroUnit: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  macroLabel: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  logBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
