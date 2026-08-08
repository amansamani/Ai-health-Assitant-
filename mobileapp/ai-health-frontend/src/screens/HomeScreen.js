import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useContext } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';
import CircularProgressRing from '../components/CircularProgressRing';

function StatCard({ icon, color, value, label, progress, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.statCard}>
      <CircularProgressRing progress={progress} size={88} strokeWidth={7} color={color}>
        <Ionicons name={icon} size={26} color={color} />
      </CircularProgressRing>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [tracking, setTracking] = useState({ steps: 0, water: 0, sleep: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchToday = useCallback(async () => {
    try { const res = await API.get('/track/today'); setTracking(res.data || { steps: 0, water: 0, sleep: 0 }); }
    catch (e) {}
  }, []);

  useFocusEffect(useCallback(() => { fetchToday(); }, [fetchToday]));

  const name = (user?.name || 'friend').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Night';
  const isNight = hour >= 17 || hour < 5;

  const steps = tracking.steps || 0, water = tracking.water || 0, sleep = tracking.sleep || 0;
  const stepPct = Math.min(steps / 10000, 1);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <Ionicons name={isNight ? 'moon' : 'sunny'} size={22} color={COLORS.primary} style={{ marginRight: SPACING.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}, {name}!</Text>
          <Text style={styles.subtitle}>Let's crush today's goals</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(app)/profile')}>
          <Text style={styles.avatarText}>{(name[0] || 'F').toUpperCase()}</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchToday(); setRefreshing(false); }} tintColor={COLORS.primary} />}>

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.heroWrap}>
          <LinearGradient colors={[COLORS.heroFrom, COLORS.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />
            <View style={styles.heroBadge}>
              <Ionicons name="flame" size={12} color="#FBBF24" />
              <Text style={styles.heroBadgeText}>TODAY'S GOAL</Text>
            </View>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Step Count</Text>
                <Text style={styles.heroValue}>{steps.toLocaleString()}</Text>
                <Text style={styles.heroOf}>of 10,000 steps</Text>
                <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${stepPct * 100}%` }]} /></View>
                <Text style={styles.heroCaption}>{Math.round(stepPct * 100)}% complete — keep going!</Text>
              </View>
              <CircularProgressRing progress={stepPct} size={104} strokeWidth={8} color={COLORS.success} trackColor="rgba(255,255,255,0.15)">
                <Text style={styles.ringPct}>{Math.round(stepPct * 100)}%</Text>
                <Text style={styles.ringDone}>Done</Text>
              </CircularProgressRing>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160)} style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Today's Stats</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/(app)/tracking')}>
            <Ionicons name="create-outline" size={14} color={COLORS.primary} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.statRow}>
          <StatCard icon="footsteps" color={COLORS.success} value={steps.toLocaleString()} label="Steps" progress={stepPct} delay={220} />
          <StatCard icon="water" color={COLORS.secondary} value={`${water.toFixed(1)} L`} label="Water" progress={Math.min(water / 2.5, 1)} delay={280} />
          <StatCard icon="moon" color={COLORS.primary} value={`${sleep.toFixed(0)}h`} label="Sleep" progress={Math.min(sleep / 8, 1)} delay={340} />
        </View>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.actionCard}>
          <View style={styles.actionAccent} />
          <View style={[styles.actionIcon, { backgroundColor: '#FFF4E0' }]}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Log Today's Food</Text>
            <Text style={styles.actionSub}>Search & add manually</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => router.push('/(app)/nutrition/meal-logger')} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(460).springify()} style={styles.motivationCard}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.primarySoft }]}>
            <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.motivationLabel}>TODAY'S MOTIVATION</Text>
            <Text style={styles.motivationText}>Every workout counts, even the short ones.</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg - 10, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: SPACING.lg - 10, paddingBottom: 130 },
  heroWrap: { borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.lg, ...SHADOWS.lg },
  hero: { padding: SPACING.lg, overflow: 'hidden' },
  heroCircle1: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.05)', top: -70, right: -50 },
  heroCircle2: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -50, right: 30 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: SPACING.md },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: '#FBBF24', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroLabel: { fontSize: 14, color: '#B9B4D8', fontWeight: '600' },
  heroValue: { fontSize: 40, fontWeight: '800', color: '#fff', letterSpacing: -1, marginTop: 2 },
  heroOf: { fontSize: 14, color: '#B9B4D8', marginTop: 2 },
  heroTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: SPACING.md },
  heroFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  heroCaption: { fontSize: 13, color: '#B9B4D8', marginTop: SPACING.sm },
  ringPct: { fontSize: 22, fontWeight: '800', color: '#fff' },
  ringDone: { fontSize: 12, fontWeight: '700', color: COLORS.success, marginTop: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  editText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  statRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, alignItems: 'center', paddingVertical: SPACING.lg - 2, paddingHorizontal: 6, ...SHADOWS.sm },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.sm },
  statLabel: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.sm },
  actionAccent: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 5, backgroundColor: COLORS.warning, borderRadius: 3 },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  actionSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  motivationCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  motivationLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, letterSpacing: 1 },
  motivationText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 3 },
});
