import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularProgressRing({
  progress = 0, size = 96, strokeWidth = 8,
  color = '#22C55E', trackColor = '#ECECF4', children,
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animated = useSharedValue(0);
  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={strokeWidth}
          fill="none" strokeLinecap="round" strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      {children && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      )}
    </View>
  );
}
