import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { EvridaDatabaseProvider } from '../src/storage/use-database';
import { FocusProvider } from '../src/features/focus/FocusProvider';
import { AppDock } from '../src/features/shell/AppDock';
import { colors } from '../src/theme/tokens';
import { useReducedMotion } from '../src/theme/useReducedMotion';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { BlurTargetView } from 'expo-blur';
import { DockInsetContext, DockVisibilityContext } from '../src/features/shell/DockInset';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useEffect(() => { void SplashScreen.hideAsync().catch(() => {}); }, []);
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: palette.background, justifyContent: 'center', padding: 28, gap: 18 }}>
    <Text style={{ color: palette.foreground, fontSize: 25, fontWeight: '700' }}>Let’s get your plan open.</Text>
    <Text style={{ color: palette.muted, fontSize: 15, lineHeight: 24 }}>Something interrupted Evrida. Try again to reopen it. Retrying does not clear your local data.</Text>
    <Pressable accessibilityRole="button" onPress={() => { void retry(); }} style={{ minHeight: 52, borderRadius: 14,
      backgroundColor: palette.accent, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: palette.onAccent, fontWeight: '700' }}>Try again</Text>
    </Pressable>
  </SafeAreaView></SafeAreaProvider>;
}

function DatabaseContent({ reducedMotion }: { reducedMotion: boolean }) {
  // The dock floats over the screens as frosted glass: screens render inside the blur
  // target, and each one reserves the measured dock height at its bottom.
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const [dockHeight, setDockHeight] = useState(0);
  const [dockHidden, setDockHidden] = useState(false);
  return <FocusProvider>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DockVisibilityContext.Provider value={setDockHidden}>
      <DockInsetContext.Provider value={dockHidden ? 0 : dockHeight}>
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, ...(reducedMotion ? { animation: 'none' as const } : {}) }} />
        </BlurTargetView>
      </DockInsetContext.Provider>
      </DockVisibilityContext.Provider>
      <AppDock blurTarget={blurTarget} onHeight={setDockHeight} hidden={dockHidden} />
    </KeyboardAvoidingView>
  </FocusProvider>;
}

function LoadingDatabase() {
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
      <ActivityIndicator color={palette.accent} size="large" />
    </View>
  );
}

export default function RootLayout() {
  const reducedMotion = useReducedMotion();
  // Local font files load in milliseconds; a failure falls back to the system family.
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });
  if (!fontsLoaded && !fontError) return <LoadingDatabase />;
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        {/* The provider never closes the process-wide connection on unmount; a startup
            failure throws to ErrorBoundary and Retry re-attempts the open. */}
        <EvridaDatabaseProvider fallback={<LoadingDatabase />}>
          <DatabaseContent reducedMotion={reducedMotion} />
        </EvridaDatabaseProvider>
      </View>
    </SafeAreaProvider>
  );
}
