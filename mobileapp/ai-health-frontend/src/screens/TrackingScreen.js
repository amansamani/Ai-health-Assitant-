import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

function StatRow({ icon, iconColor, label, value, unit, sub, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.statRow}>
      <View style={[styles.statIcon, { backgroundColor: iconColor + '20' }]}><Ionicons name={icon} size={20} color={iconColor} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
      <Text style={styles.statValue}>{value}{unit ? <Text style={styles.statUnit}> {unit}</Text> : null}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
    </Animated.View>
  );
}

export default function TrackingScreen() {
  const router = useRouter();
  const [data, setData] = useState({ steps: 0, water: 0, sleep: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchToday = useCallback(async () => {
    try { const res = await API.get('/track/today'); setData(res.data || { steps: 0, water: 0, sleep: 0 }); }
    catch (e) {}
  }, []);

  useFocusEffect(useCallback(() => { fetchToday(); }, [fetchToday]));

  const openEdit = (field, current) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditing(field); setEditValue(current ? String(current) : ''); };

  const saveField = async () => {
    const val = parseFloat(editValue) || 0;
    const updated = { ...data, [editing]: val };
    try { await API.post('/track/today', updated); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setEditing(null); fetchToday(); }
    catch (e) {}
  };

  const editLabel = editing === 'steps' ? 'Steps' : editing === 'water' ? 'Water (liters)' : 'Sleep (hours)';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Tracking</Text>
        <Text style={styles.subtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchToday(); setRefreshing(false); }} tintColor={COLORS.primary} />}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => openEdit('steps', data.steps)}>
          <StatRow icon="footsteps" iconColor={COLORS.primary} label="Steps" value={(data.steps || 0).toLocaleString()} sub="Tap to update" delay={80} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => openEdit('water', data.water)}>
          <StatRow icon="water" iconColor={COLORS.secondary} label="Water" value={(data.water || 0).toFixed(1)} unit="L" sub="Tap to update" delay={160} />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} onPress={() => openEdit('sleep', data.sleep)}>
          <StatRow icon="moon" iconColor={COLORS.accent} label="Sleep" value={(data.sleep || 0).toFixed(1)} unit="hrs" sub="Tap to update" delay={240} />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.delay(320)} style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(app)/water-tracking')}>
            <Ionicons name="water-outline" size={18} color={COLORS.secondary} /><Text style={styles.quickText}>Water Log</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.navigate('/(app)/(tabs)/diet')}>
            <Ionicons name="nutrition-outline" size={18} color={COLORS.warning} /><Text style={styles.quickText}>Meal Log</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditing(null)}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Log {editLabel}</Text>
              <TextInput style={styles.modalInput} value={editValue} onChangeText={setEditValue}
                keyboardType={editing === 'steps' ? 'number-pad' : 'decimal-pad'} placeholder="Enter value" placeholderTextColor={COLORS.textTertiary} autoFocus />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveField}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 130 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.sm },
  statIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statSub: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statUnit: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  quickRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.md },
  quickText: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.md },
  modalInput: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  modalBtns: { flexDirection: 'row', gap: SPACING.md },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceElevated, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
