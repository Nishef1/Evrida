import { useEffect, useState } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { migrateDatabase } from '../src/storage/database';
import { FocusProvider } from '../src/features/focus/FocusProvider';
import { AppDock } from '../src/features/shell/AppDock';
import { colors } from '../src/theme/tokens';
import { useReducedMotion } from '../src/theme/useReducedMotion';

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

async function initializeDatabase(db: SQLiteDatabase) {
  try { await migrateDatabase(db); }
  catch (error) { await db.closeAsync().catch(() => {}); throw error; }
}

function DatabaseContent({ onReady, reducedMotion }: { onReady: (ready: boolean) => void; reducedMotion: boolean }) {
  useEffect(() => { onReady(true); }, [onReady]);
  return <FocusProvider>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, ...(reducedMotion ? { animation: 'none' as const } : {}) }} /></View>
      <AppDock />
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
  const [databaseReady, setDatabaseReady] = useState(false);
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        {/* Suspense mode caches rejected startup promises globally in this SDK;
            a fresh provider must be able to reopen the DB when Retry is tapped. */}
        <SQLiteProvider databaseName="evrida.db" onInit={initializeDatabase}>
          <DatabaseContent onReady={setDatabaseReady} reducedMotion={reducedMotion} />
        </SQLiteProvider>
        {!databaseReady ? <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}><LoadingDatabase /></View> : null}
      </View>
    </SafeAreaProvider>
  );
}
