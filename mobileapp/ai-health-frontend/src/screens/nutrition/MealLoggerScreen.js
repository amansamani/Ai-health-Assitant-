"use strict";
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import API from '../../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../constants/theme';

const FILTERS = [
  { label: 'All', tags: [], dietType: null },
  { label: 'High Protein', tags: ['high-protein'], dietType: null },
  { label: 'Veg', tags: [], dietType: 'veg' },
  { label: 'Low Carb', tags: ['low-carb'], dietType: null },
];

function FoodCard({ food, onSelect, index }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <TouchableOpacity style={styles.foodCard} onPress={() => onSelect(food)} activeOpacity={0.8}>
        <View style={styles.foodIcon}><Text style={{ fontSize: 22 }}>{food.emoji || '🍽️'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.foodName} numberOfLines={1}>{food.name}</Text>
          <Text style={styles.foodBrand} numberOfLines={1}>{food.brand || 'Generic'}</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}><Text style={styles.chipText}>{food.calories} cal</Text></View>
            <View style={[styles.chip, { backgroundColor: 'rgba(34,197,94,0.12)' }]}><Text style={[styles.chipText, { color: COLORS.success }]}>{food.protein}g P</Text></View>
            <View style={[styles.chip, { backgroundColor: 'rgba(245,158,11,0.12)' }]}><Text style={[styles.chipText, { color: COLORS.warning }]}>{food.carbs}g C</Text></View>
          </View>
        </View>
        <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MealLoggerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mealType = params.mealType || 'breakfast';
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState(0);
  const searchTimeout = useRef(null);

  const doSearch = useCallback(async (query) => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true); setSearched(true);
    try { const res = await API.get(`/nutrition/foods?search=${encodeURIComponent(query)}`); setResults(res.data?.data || []); }
    catch (e) { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = (text) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(text), 400);
  };

  const handleFilter = async (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(index);
    const f = FILTERS[index];
    if (!f.tags.length && !f.dietType) { doSearch(search); return; }
    setLoading(true); setSearched(true);
    try {
      const p = new URLSearchParams();
      if (f.tags.length) p.append('tags', f.tags.join(','));
      if (f.dietType) p.append('dietType', f.dietType);
      const res = await API.get(`/nutrition/foods?${p.toString()}`);
      setResults(res.data?.data || []);
    } catch (e) { setResults([]); }
    finally { setLoading(false); }
  };

  const selectFood = (food) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(app)/nutrition/log-meal', params: { food: JSON.stringify(food), mealType } });
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log {mealType.charAt(0).toUpperCase() + mealType.slice(1)}</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textTertiary} />
          <TextInput style={styles.searchInput} placeholder="Search foods..." placeholderTextColor={COLORS.textTertiary}
            value={search} onChangeText={handleSearch} autoFocus returnKeyType="search" onSubmitEditing={() => doSearch(search)} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.filterRow}>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={[styles.filterChip, activeFilter === index && styles.filterChipActive]} onPress={() => handleFilter(index)}>
              <Text style={[styles.filterText, activeFilter === index && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )} />
      </Animated.View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.loadingText}>Searching...</Text></View>
      ) : searched && results.length === 0 ? (
        <View style={styles.emptyWrap}><Ionicons name="search-outline" size={48} color={COLORS.textTertiary} /><Text style={styles.emptyTitle}>No results found</Text><Text style={styles.emptySub}>Try a different search term.</Text></View>
      ) : (
        <FlatList data={results} keyExtractor={(item, i) => item._id || String(i)} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => <FoodCard food={item} onSelect={selectFood} index={index} />}
          ListEmptyComponent={!searched ? (
            <View style={styles.promptWrap}><Ionicons name="nutrition-outline" size={48} color={COLORS.textTertiary} /><Text style={styles.emptyTitle}>Search for a food</Text><Text style={styles.emptySub}>Type above to find foods.</Text></View>
          ) : null} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  searchWrap: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 52 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  filterRow: { marginBottom: SPACING.md },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  foodCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  foodIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  foodName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  foodBrand: { fontSize: 12, color: COLORS.textTertiary, marginTop: 1 },
  chipRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  chip: { backgroundColor: COLORS.surfaceElevated, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: COLORS.textSecondary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  promptWrap: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textSecondary },
});
