import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import API from '../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

function StatBox({ icon, color, label, value, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}><Ionicons name={icon} size={20} color={color} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function WeeklySummaryScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState(null);
  const [insight, setInsight] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [sumRes, insRes] = await Promise.all([
          API.get('/track/weekly').catch(() => null),
          API.get('/nutrition/weekly-insight').catch(() => null),
        ]);
        setSummary(sumRes?.data || null);
        setInsight(insRes?.data || null);
      } catch (e) {}
    };
    fetch();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Summary</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.insightCard}>
          <LinearGradient colors={[COLORS.heroFrom, COLORS.heroTo]} style={styles.gradientFill}>
            <View style={{ padding: SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.insightTitle}>AI Weekly Insight</Text>
              </View>
              <Text style={styles.insightText}>{insight?.message || 'Complete more meals and workouts to unlock your weekly AI insight!'}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.statsGrid}>
          <StatBox icon="flame" color={COLORS.primary} label="Avg Steps" value={summary?.avgSteps?.toLocaleString?.() || summary?.avgSteps || '—'} delay={200} />
          <StatBox icon="water" color={COLORS.secondary} label="Avg Water" value={`${summary?.avgWater || 0}L`} delay={250} />
          <StatBox icon="moon" color={COLORS.accent} label="Avg Sleep" value={`${summary?.avgSleep || 0}h`} delay={300} />
          <StatBox icon="barbell" color={COLORS.warning} label="Workouts" value={summary?.workoutsDone || '—'} delay={350} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  insightCard: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.lg, ...SHADOWS.md },
  gradientFill: { flex: 1 },
  insightTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  insightText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statBox: { width: '47%', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
});
