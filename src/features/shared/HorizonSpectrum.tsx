import { View } from 'react-native';
import { HORIZONS, type Horizon } from '../../domain/horizons';
import type { Palette } from '../../theme/tokens';

/**
 * The seven planning horizons as one sunrise-to-midnight strip. It repeats the
 * horizon selector's state visually and is hidden from screen readers so the
 * selector remains the single accessible control.
 */
export function HorizonSpectrum({ palette, active, height = 6 }: { palette: Palette; active?: Horizon; height?: number }) {
  // Every band keeps its full color; the active one is simply taller, so the strip
  // reads as a map of time scales rather than a progress bar.
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ flexDirection: 'row', gap: 3, height: height + 4, alignItems: 'center' }}>
    {HORIZONS.map((item) => {
      const size = active === item ? height + 4 : active ? height - 2 : height;
      return <View key={item} style={{ flex: 1, height: size, borderRadius: size / 2, backgroundColor: palette.horizon[item] }} />;
    })}
  </View>;
}
