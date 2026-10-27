import { useRouter } from 'expo-router';
import { Pressable, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../src/theme/tokens';

export default function NotFound() {
  const router = useRouter(), palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  return <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 26, gap: 18, backgroundColor: palette.background }}>
    <Text style={{ fontSize: 26, fontWeight: '700', color: palette.foreground }}>Let’s find your way back.</Text>
    <Text style={{ fontSize: 15, lineHeight: 24, color: palette.muted }}>This link does not open a page in Evrida. Your plans are available from Plan.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={{ minHeight: 52, borderRadius: 14, backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: palette.onAccent, fontWeight: '700' }}>Open your plan</Text>
    </Pressable>
  </SafeAreaView>;
}
