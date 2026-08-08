// src/components/AiCoachFab.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '@/src/constants/theme';

export default function AiCoachFab() {
  const router = useRouter();
  const scale = useSharedValue(1);

  // Subtle breathing animation
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: 0.3 + pulse.value * 0.2,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(app)/coach');
  };

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        onPressIn={() => { scale.value = withSpring(0.9); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={styles.fab}
      >
        <Ionicons name="sparkles" size={24} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 99,
    ...SHADOWS.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
