import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const name = params.name || 'Exercise';
  const sets = params.sets || '3';
  const reps = params.reps || '12';

  const markComplete = async () => {
    if (!params.planId) { setCompleted(true); return; }
    setSaving(true);
    try {
      await API.post('/workouts/complete', { workoutPlanId: params.planId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCompleted(true);
    } catch (e) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{params.title || 'Exercise'}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(60)} style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="barbell" size={44} color={COLORS.primary} /></View>
          <Text style={styles.exName}>{name}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140)} style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statValue}>{sets}</Text><Text style={styles.statLabel}>Sets</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>{reps}</Text><Text style={styles.statLabel}>Reps</Text></View>
          <View style={styles.statBox}><Text style={styles.statValue}>60s</Text><Text style={styles.statLabel}>Rest</Text></View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220)} style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Form Tips</Text>
          <Text style={styles.tipsText}>
            {'• Keep your back straight and core engaged\n• Control the movement\n• Breathe out during the hardest part\n• Stop if you feel sharp pain'}
          </Text>
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(300)} style={styles.bottomBar}>
        <TouchableOpacity style={[styles.completeBtn, completed && styles.completedBtn]} onPress={markComplete} disabled={completed || saving}>
          <Ionicons name={completed ? 'checkmark-circle' : 'play-circle-outline'} size={22} color={completed ? COLORS.success : '#fff'} />
          <Text style={[styles.completeText, completed && { color: COLORS.success }]}>{completed ? 'Completed!' : 'Mark Complete'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg - 10, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  backBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: SPACING.lg - 10, paddingBottom: 120 },
  hero: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, alignItems: 'center', paddingVertical: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.sm },
  heroIcon: { width: 96, height: 96, borderRadius: 28, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  exName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  tipsCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  tipsTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  tipsText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 22 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.lg, paddingBottom: 34 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  completedBtn: { backgroundColor: COLORS.primarySoft },
  completeText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
