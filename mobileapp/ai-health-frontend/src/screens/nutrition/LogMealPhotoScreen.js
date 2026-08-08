"use strict";
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import API from '../../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../constants/theme';

function MacroPill({ label, value, color }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '20' }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
      <Text style={styles.pillValue}>{value || 0}</Text>
    </View>
  );
}

export default function LogMealPhotoScreen() {
  const router = useRouter();
  const [photo, setPhoto] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const pick = async (mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options = { mediaTypes: 'images', base64: true, quality: 0.7 };
    let res;
    try {
      res = mode === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    } catch (e) { Alert.alert('Camera unavailable', 'Please pick from gallery instead.'); return; }
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setPhoto(asset); setResult(null);
    analyze(asset.base64);
  };

  const analyze = async (base64) => {
    if (!base64) { Alert.alert('No image data', 'Please retake the photo.'); return; }
    setAnalyzing(true);
    try {
      const res = await API.post('/nutrition/analyze-meal-photo', { image: base64 });
      setResult(res.data?.data || res.data);
    } catch (e) {
      Alert.alert('Analysis failed', 'Could not analyze the photo. Try better lighting.');
    } finally { setAnalyzing(false); }
  };

  const logIt = () => {
    if (!result) return;
    const food = { name: result.name || result.food || 'Photo Meal', calories: result.calories || 0, protein: result.protein || 0, carbs: result.carbs || 0, fats: result.fats || 0, quantity: 1, unit: 'serving' };
    router.push({ pathname: '/(app)/nutrition/log-meal', params: { food: JSON.stringify(food), mealType: 'lunch' } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Food Camera</Text>
        <Text style={styles.subtitle}>Snap a meal — AI logs it for you</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(80)} style={styles.previewWrap}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.preview} /> : (
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={52} color={COLORS.textTertiary} />
              <Text style={styles.placeholderText}>No photo yet</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160)} style={styles.actionRow}>
          <TouchableOpacity style={styles.cameraBtn} onPress={() => pick('camera')}>
            <Ionicons name="camera" size={20} color="#fff" /><Text style={styles.cameraBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryBtn} onPress={() => pick('gallery')}>
            <Ionicons name="images-outline" size={20} color={COLORS.textPrimary} /><Text style={styles.galleryBtnText}>Gallery</Text>
          </TouchableOpacity>
        </Animated.View>

        {analyzing && (
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.analyzingText}>AI is analyzing your meal…</Text>
          </View>
        )}

        {result && !analyzing && (
          <Animated.View entering={FadeInDown.springify()} style={styles.resultCard}>
            <Text style={styles.resultName}>{result.name || result.food || 'Detected Meal'}</Text>
            <View style={styles.macroRow}>
              <MacroPill label="Cal" value={result.calories} color={COLORS.primary} />
              <MacroPill label="P" value={result.protein} color={COLORS.secondary} />
              <MacroPill label="C" value={result.carbs} color={COLORS.warning} />
              <MacroPill label="F" value={result.fats} color={COLORS.danger} />
            </View>
            <TouchableOpacity style={styles.logBtn} onPress={logIt}>
              <Ionicons name="add-circle" size={18} color="#fff" /><Text style={styles.logBtnText}>Add to Log</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 130 },
  previewWrap: { borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  preview: { width: '100%', height: 240 },
  placeholder: { width: '100%', height: 240, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 13, color: COLORS.textTertiary, marginTop: SPACING.sm },
  actionRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  cameraBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  cameraBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  galleryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.md },
  galleryBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  analyzingCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg },
  analyzingText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  resultCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg },
  resultName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.md },
  macroRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  pill: { flex: 1, alignItems: 'center', borderRadius: RADIUS.sm, paddingVertical: SPACING.sm },
  pillLabel: { fontSize: 11, fontWeight: '800' },
  pillValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  logBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  logBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
