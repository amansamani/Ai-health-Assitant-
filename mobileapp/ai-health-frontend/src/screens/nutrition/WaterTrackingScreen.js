"use strict";
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../../services/api';
import CircularProgressRing from '../../components/CircularProgressRing';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../constants/theme';

const QUICK_ADD = [
  { amount: 150, label: 'Sip', icon: '💧' },
  { amount: 250, label: 'Glass', icon: '🥤' },
  { amount: 500, label: 'Bottle', icon: '🍶' },
  { amount: 750, label: 'Large', icon: '🫗' },
];

function QuickAddBtn({ item, onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <TouchableOpacity style={styles.quickBtn} onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.93); }} onPressOut={() => { scale.value = withSpring(1); }}>
        <Text style={{ fontSize: 24 }}>{item.icon}</Text>
        <Text style={styles.quickLabel}>{item.label}</Text>
        <Text style={styles.quickAmount}>{item.amount}ml</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function WaterTrackingScreen() {
  const router = useRouter();
  const [log, setLog] = useState(null);

  const fetchWater = useCallback(async () => {
    try { const res = await API.get('/nutrition/water'); setLog(res.data); } catch (e) {}
  }, []);

  useFocusEffect(useCallback(() => { fetchWater(); }, [fetchWater]));

  const addWater = async (amount, label) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await API.post('/nutrition/water', { amount, label }); fetchWater(); }
    catch (e) { Alert.alert('Error', 'Could not log water.'); }
  };

  const undoLast = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { await API.delete('/nutrition/water/last'); fetchWater(); } catch (e) {}
  };

  const totalMl = log?.totalMl || 0;
  const goalMl = log?.goalMl || 2500;
  const pct = Math.min(totalMl / goalMl, 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Water Tracking</Text>
        <TouchableOpacity style={styles.backBtn} onPress={undoLast}>
          <Ionicons name="arrow-undo" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.ringWrap}>
        <CircularProgressRing progress={pct} size={200} strokeWidth={14} color={COLORS.secondary}>
          <Text style={styles.ringValue}>{(totalMl / 1000).toFixed(1)}L</Text>
          <Text style={styles.ringGoal}>of {(goalMl / 1000).toFixed(1)}L</Text>
        </CircularProgressRing>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.quickRow}>
        {QUICK_ADD.map((item, i) => <QuickAddBtn key={i} item={item} onPress={() => addWater(item.amount, item.label)} />)}
      </Animated.View>

      <Text style={styles.timelineTitle}>Today's Log</Text>
      <FlatList data={log?.logs || []} keyExtractor={(_, i) => String(i)} contentContainerStyle={styles.timeline} showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(300 + index * 50)} style={styles.timelineItem}>
            <View style={styles.timelineDot}><Text style={{ fontSize: 14 }}>{item.label === 'Water' ? '💧' : '🥤'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineLabel}>{item.label}</Text>
              <Text style={styles.timelineTime}>{new Date(item.loggedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <Text style={styles.timelineAmount}>{item.amount} ml</Text>
          </Animated.View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No water logged yet. Start drinking! 💪</Text>} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  ringWrap: { alignItems: 'center', marginVertical: SPACING.lg },
  ringValue: { fontSize: 36, fontWeight: '800', color: COLORS.textPrimary },
  ringGoal: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  quickBtn: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', paddingVertical: SPACING.md },
  quickLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary, marginTop: 4 },
  quickAmount: { fontSize: 10, color: COLORS.textTertiary },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  timeline: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm },
  timelineDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(47,128,237,0.12)', alignItems: 'center', justifyContent: 'center' },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  timelineTime: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
  timelineAmount: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },
  emptyText: { fontSize: 14, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.lg },
});
