import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

function ProfileRow({ icon, label, onPress, danger = false, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.rowIcon, danger && { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
          <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.textSecondary} />
        </View>
        <Text style={[styles.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, userGoal } = useContext(AuthContext);

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    logout();
    router.replace('/(auth)/login');
  };

  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.avatarCard}>
          <View style={styles.avatarCircle}><Text style={styles.avatarText}>{firstName[0]?.toUpperCase()}</Text></View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <View style={styles.goalBadge}>
            <Ionicons name="flag" size={12} color={COLORS.primary} />
            <Text style={styles.goalText}>Goal: {userGoal || 'fit'}</Text>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Settings</Text>
        <ProfileRow icon="person-outline" label="Edit Health Profile" onPress={() => router.push('/(app)/edit-health-profile')} delay={200} />
        <ProfileRow icon="nutrition-outline" label="Nutrition Dashboard" onPress={() => router.navigate('/(app)/(tabs)/diet')} delay={250} />
        <ProfileRow icon="water-outline" label="Water Tracking" onPress={() => router.push('/(app)/water-tracking')} delay={300} />
        <ProfileRow icon="calendar-outline" label="Weekly Summary" onPress={() => router.push('/(app)/weekly-summary')} delay={350} />

        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Account</Text>
        <ProfileRow icon="lock-closed-outline" label="Change Password" onPress={() => router.push('/(auth)/reset-password')} delay={400} />
        <ProfileRow icon="log-out-outline" label="Log Out" onPress={handleLogout} danger delay={450} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  avatarCard: { alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.sm },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  userEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  goalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginTop: SPACING.md },
  goalText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
});
