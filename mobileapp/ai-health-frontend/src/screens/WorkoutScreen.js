import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useContext } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

export default function WorkoutScreen() {
  const router = useRouter();
  const { userGoal } = useContext(AuthContext);
  const goal = ['bulk', 'lean', 'fit'].includes(userGoal) ? userGoal : 'fit';
  const [mode, setMode] = useState('bodyweight');
  const [plans, setPlans] = useState([]);
  const [doneDays, setDoneDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [planRes, doneRes] = await Promise.all([
        API.get(`/workouts?goal=${goal}&mode=${mode}`),
        API.get('/workouts/completed?days=7').catch(() => null),
      ]);
      setPlans(planRes.data || []);
      const logs = doneRes?.data?.logs || doneRes?.data || [];
      setDoneDays(new Set(logs.map(l => new Date(l.date).toDateString())).size);
    } catch (e) { setPlans([]); }
    finally { setLoading(false); }
  }, [goal, mode]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [fetchData]));

  const todayPlan = plans.length ? plans[new Date().getDay() % plans.length] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          <Text style={styles.headerTitle}>Today's Workout</Text>
        </View>
      </View>

      <View style={styles.toggleRow}>
        {['bodyweight', 'equipment'].map(m => (
          <TouchableOpacity key={m} style={[styles.toggleChip, mode === m && styles.toggleChipActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode(m); }}>
            <Ionicons name={m === 'bodyweight' ? 'body-outline' : 'barbell-outline'} size={14} color={mode === m ? '#fff' : COLORS.textSecondary} />
            <Text style={[styles.toggleText, mode === m && { color: '#fff' }]}>{m === 'bodyweight' ? 'Bodyweight' : 'Equipment'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} tintColor={COLORS.primary} />}>

        <Animated.View entering={FadeInDown.delay(60)} style={styles.progressCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressTitle}>This Week</Text>
            <Text style={styles.progressSub}>{doneDays} of 7 sessions completed</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(doneDays / 7) * 100}%` }]} /></View>
          </View>
          <View style={styles.progressCircle}><Text style={styles.progressPct}>{Math.round((doneDays / 7) * 100)}%</Text></View>
        </Animated.View>

        {todayPlan && (
          <Animated.View entering={FadeInDown.delay(120)} style={styles.planHeader}>
            <Text style={styles.planDay}>Day {todayPlan.day}</Text>
            <Text style={styles.planTitle}>{todayPlan.title}</Text>
          </Animated.View>
        )}

        {!loading && (!todayPlan || !todayPlan.exercises?.length) ? (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={52} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No workouts found</Text>
            <Text style={styles.emptySub}>No {mode} workouts for goal "{goal}" yet.</Text>
          </View>
        ) : (
          (todayPlan?.exercises || []).map((ex, i) => (
            <Animated.View key={ex._id || i} entering={FadeInRight.delay(150 + i * 70).springify()}>
              <TouchableOpacity style={styles.exCard} activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(app)/workout-detail', params: { name: ex.name, sets: String(ex.sets), reps: ex.reps, planId: todayPlan._id, title: todayPlan.title } })}>
                <View style={styles.exIcon}><Ionicons name="barbell" size={22} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName} numberOfLines={1}>{ex.name}</Text>
                  <Text style={styles.exMeta}>{ex.sets} sets × {ex.reps} reps</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg - 10, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  headerDate: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  toggleRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg - 10, paddingBottom: SPACING.md },
  toggleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  toggleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  list: { paddingHorizontal: SPACING.lg - 10, paddingBottom: 130 },
  progressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.sm },
  progressTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  progressSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  progressTrack: { height: 6, backgroundColor: COLORS.track, borderRadius: 3, marginTop: SPACING.sm },
  progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  progressCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.md },
  progressPct: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  planHeader: { marginBottom: SPACING.md },
  planDay: { fontSize: 11, fontWeight: '800', color: COLORS.warning, letterSpacing: 1, textTransform: 'uppercase' },
  planTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  exCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  exIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  exName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  exMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.md },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
});
