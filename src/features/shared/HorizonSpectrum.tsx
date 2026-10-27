import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { HORIZONS, HORIZON_TITLES, type Horizon } from '../../domain/horizons';
import { motion } from '../../theme/motion';
import type { Palette } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';

function Band({ color, size, reduced }: { color: string; size: number; reduced: boolean }) {
  const thickness = useSharedValue(size);
  useEffect(() => { thickness.value = reduced ? size : withTiming(size, { duration: motion.base }); }, [size, reduced, thickness]);
  const style = useAnimatedStyle(() => ({ height: thickness.value, borderRadius: thickness.value / 2 }));
  return <Animated.View style={[{ backgroundColor: color }, style]} />;
}

/**
 * The seven planning horizons as one sunrise-to-midnight strip and a quick
 * switch between them. Every band keeps its full color; the active one is
 * taller, so the strip reads as a map of time scales rather than progress.
 * Each band is a 44dp touch target with a labeled tab role.
 */
export function HorizonSpectrum({ palette, active, height = 6, onSelect }: {
  palette: Palette; active?: Horizon; height?: number; onSelect?: (horizon: Horizon) => void;
}) {
  const reduced = useReducedMotion();
  return <View style={{ flexDirection: 'row', gap: 3 }} accessibilityRole="tablist">
    {HORIZONS.map((item) => {
      const size = active === item ? height + 4 : active ? height - 2 : height;
      return <Pressable key={item} accessibilityRole="tab" accessibilityLabel={`${HORIZON_TITLES[item]} horizon`}
        accessibilityState={{ selected: active === item }} disabled={!onSelect}
        onPress={() => onSelect?.(item)} style={{ flex: 1, height: 44, justifyContent: 'center' }}>
        <Band color={palette.horizon[item]} size={size} reduced={reduced} />
      </Pressable>;
    })}
  </View>;
}
