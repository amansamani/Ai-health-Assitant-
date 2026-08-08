import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import API from '../services/api';
import CircularProgressRing from '../components/CircularProgressRing';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

export default function TrackDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const date = params.date;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get('/track/recent/7');
        const logs = res.data?.logs || res.data || [];
        const match = logs.find(l => {
          const d = new Date(l.date);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return iso === date;
        });
        setData(match || logs[0] || null);
      } catch (e) {}
      finally { setLoading(false); }
    };
    fetch();
  }, [date]);

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const steps = data?.steps || 0, water = data?.water || 0, sleep = data?.sleep || 0;
  const formattedDate = date ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(80)} style={styles.dateBanner}>
          <Ionicons name="calendar" size={18} color={COLORS.primary} />
          <Text style={styles.dateText}>{formattedDate}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160)} style={styles.ringCard}>
          <CircularProgressRing progress={Math.min(steps / 10000, 1)} size={120} strokeWidth={10} color={COLORS.primary}>
            <Ionicons name="footsteps" size={24} color={COLORS.primary} />
            <Text style={styles.ringValue}>{steps.toLocaleString()}</Text>
          </CircularProgressRing>
          <View style={{ flex: 1, marginLeft: SPACING.lg }}>
            <Text style={styles.ringLabel}>Steps</Text>
            <Text style={styles.ringSub}>Goal: 10,000 steps</Text>
            <Text style={styles.ringPct}>{Math.round(Math.min(steps / 10000, 1) * 100)}% complete</Text>
          </View>
        </Animated.View>

        <View style={styles.row2}>
          <Animated.View entering={FadeInDown.delay(240)} style={styles.halfCard}>
            <View style={[styles.halfIcon, { backgroundColor: 'rgba(47,128,237,0.12)' }]}><Ionicons name="water" size={22} color={COLORS.secondary} /></View>
            <Text style={styles.halfValue}>{water.toFixed(1)}L</Text>
            <Text style={styles.halfLabel}>Water</Text>
            <Text style={styles.halfSub}>Goal: 2.5L</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(320)} style={styles.halfCard}>
            <View style={[styles.halfIcon, { backgroundColor: 'rgba(108,71,255,0.12)' }]}><Ionicons name="moon" size={22} color={COLORS.accent} /></View>
            <Text style={styles.halfValue}>{sleep.toFixed(1)}h</Text>
            <Text style={styles.halfLabel}>Sleep</Text>
            <Text style={styles.halfSub}>Goal: 8h</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Daily Tip</Text>
          <Text style={styles.tipsText}>
            {steps < 5000 ? 'You are below your step goal. Try a 15-minute walk!' : water < 1.5 ? 'Great steps! Drink a glass of water to stay hydrated.' : 'Amazing job! You are on track with all goals today. 🎉'}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  dateBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  dateText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  ringCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  ringValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  ringLabel: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  ringSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  ringPct: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: SPACING.sm },
  row2: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  halfCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.sm },
  halfIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  halfValue: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  halfLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },
  halfSub: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
  tipsCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, ...SHADOWS.sm },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  tipsText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 21 },
});
