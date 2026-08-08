import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';

function SelectChip({ label, selected, onPress, color = COLORS.primary }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]} onPress={onPress}>
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EditInput({ label, icon, value, onChangeText, keyboardType = 'numeric', placeholder, unit }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && { borderColor: COLORS.primary }]}>
        <Ionicons name={icon} size={18} color={focused ? COLORS.primary : COLORS.textTertiary} />
        <TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={COLORS.textTertiary} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

export default function EditHealthProfileScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ age: '', gender: '', height: '', weight: '', activityLevel: '', goal: '', dietType: '', diseases: '', allergies: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/health');
        const p = res.data;
        if (p) setForm({ age: String(p.age || ''), gender: p.gender || '', height: String(p.height || ''), weight: String(p.weight || ''), activityLevel: p.activityLevel || '', goal: p.goal || '', dietType: p.dietType || '', diseases: (p.diseases || []).join(', '), allergies: (p.allergies || []).join(', ') });
      } catch (e) {}
      finally { setFetching(false); }
    };
    load();
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const { age, gender, height, weight, activityLevel, goal, dietType } = form;
    if (!age || !gender || !height || !weight || !activityLevel || !goal || !dietType) { Alert.alert('Missing fields', 'Please fill in all required fields.'); return; }
    setLoading(true);
    try {
      await API.post('/health', { age: parseInt(age), gender, height: parseFloat(height), weight: parseFloat(weight), activityLevel, goal, dietType, diseases: form.diseases ? form.diseases.split(',').map(s => s.trim()).filter(Boolean) : [], allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Updated! ✅', 'Your health profile has been saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save profile.');
    } finally { setLoading(false); }
  };

  if (fetching) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Health Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInDown.delay(80)} style={styles.card}>
            <View style={styles.row2}>
              <EditInput label="Age" icon="calendar-outline" value={form.age} onChangeText={v => set('age', v)} placeholder="25" unit="yrs" />
              <EditInput label="Height" icon="resize-outline" value={form.height} onChangeText={v => set('height', v)} placeholder="170" unit="cm" />
            </View>
            <EditInput label="Weight" icon="scale-outline" value={form.weight} onChangeText={v => set('weight', v)} placeholder="70" unit="kg" />
            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.chipRow}>
              <SelectChip label="Male" selected={form.gender === 'male'} onPress={() => set('gender', 'male')} />
              <SelectChip label="Female" selected={form.gender === 'female'} onPress={() => set('gender', 'female')} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160)} style={styles.card}>
            <Text style={styles.inputLabel}>Activity Level</Text>
            <View style={styles.chipRow}>
              {['sedentary', 'light', 'moderate', 'active'].map(a => (
                <SelectChip key={a} label={a.charAt(0).toUpperCase() + a.slice(1)} selected={form.activityLevel === a} onPress={() => set('activityLevel', a)} color={COLORS.secondary} />
              ))}
            </View>
            <Text style={styles.inputLabel}>Goal</Text>
            <View style={styles.chipRow}>
              {[{ l: 'Lose Fat', v: 'lose' }, { l: 'Maintain', v: 'maintain' }, { l: 'Gain Muscle', v: 'gain' }].map(g => (
                <SelectChip key={g.v} label={g.l} selected={form.goal === g.v} onPress={() => set('goal', g.v)} color={COLORS.warning} />
              ))}
            </View>
            <Text style={styles.inputLabel}>Diet Type</Text>
            <View style={styles.chipRow}>
              {[{ l: 'Veg', v: 'veg' }, { l: 'Non-Veg', v: 'non-veg' }, { l: 'Vegan', v: 'vegan' }].map(d => (
                <SelectChip key={d.v} label={d.l} selected={form.dietType === d.v} onPress={() => set('dietType', d.v)} color={COLORS.accent} />
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240)} style={styles.card}>
            <EditInput label="Diseases (comma separated)" icon="medkit-outline" value={form.diseases} onChangeText={v => set('diseases', v)} keyboardType="default" placeholder="diabetes, hypertension" />
            <EditInput label="Allergies (comma separated)" icon="warning-outline" value={form.allergies} onChangeText={v => set('allergies', v)} keyboardType="default" placeholder="peanuts, lactose" />
          </Animated.View>

          <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <><Ionicons name="save-outline" size={20} color="#fff" /><Text style={styles.saveText}>Save Changes</Text></>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 60 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  row2: { flexDirection: 'row', gap: SPACING.md },
  inputGroup: { flex: 1, marginBottom: SPACING.sm },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs, marginTop: SPACING.xs },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 50 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  unit: { fontSize: 13, color: COLORS.textTertiary, fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.sm },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm, marginBottom: SPACING.sm },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.sm },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
