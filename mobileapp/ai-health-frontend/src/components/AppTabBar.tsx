import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '@/src/constants/theme';

const TAB_ICONS: Record<string, { active: any; inactive: any }> = {
  home:     { active: 'home',    inactive: 'home-outline' },
  workout:  { active: 'barbell', inactive: 'barbell-outline' },
  camera:   { active: 'camera',  inactive: 'camera' },
  diet:     { active: 'nutrition', inactive: 'nutrition-outline' },
  tracking: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};
const TAB_LABELS: Record<string, string> = {
  home: 'Home', workout: 'Exercise', camera: '', diet: 'Diet', tracking: 'Track',
};

export default function AppTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const isCenter = route.name === 'camera';
          const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse' };
          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          if (isCenter) {
            return (
              <TouchableOpacity key={route.key} onPress={onPress} style={styles.centerWrap}>
                <LinearGradient colors={['#8B6CFF', '#5B3DF5']} style={styles.centerBtn}>
                  <Ionicons name="camera" size={26} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.tab}>
              <View style={[styles.pill, isFocused && styles.pillActive]}>
                <Ionicons name={isFocused ? icons.active : icons.inactive} size={20}
                  color={isFocused ? '#fff' : COLORS.textTertiary} />
              </View>
              <Text style={[styles.label, { color: isFocused ? COLORS.primary : COLORS.textTertiary }]}>
                {TAB_LABELS[route.name]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingHorizontal: 8, ...SHADOWS.lg,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  pill: { height: 34, minWidth: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  pillActive: { backgroundColor: COLORS.primary },
  label: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  centerWrap: { flex: 1, alignItems: 'center' },
  centerBtn: {
    width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    marginTop: -30, borderWidth: 5, borderColor: '#FFFFFF', ...SHADOWS.lg,
  },
});
