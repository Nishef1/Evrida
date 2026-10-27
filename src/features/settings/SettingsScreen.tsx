import { useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvridaDatabase } from '../../storage/use-database';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { MAX_BACKUP_BYTES, parseBackup } from '../../domain/backup';
import { exportBackup, previewBackupMerge, restoreBackup } from '../../storage/backup';
import { checkLocalHealth, type LocalHealth } from '../../storage/health';
import { colors } from '../../theme/tokens';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { type } from '../../theme/type';
import { useDockInset } from '../shell/DockInset';

export function SettingsScreen() {
  const dockInset = useDockInset();
  const db = useEvridaDatabase(), router = useRouter();
  const palette = useColorScheme() === 'dark' ? colors.dark : colors.light;
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const [health, setHealth] = useState<LocalHealth | null>(null);
  const locked = useRef(false);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setNotice(null); setHealth(null);
    try { await action(); }
    catch (error) { Alert.alert('Could not finish', error instanceof Error ? error.message : 'Please try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  function cleanupOldExports() {
    // Keep newly shared files available to receiving apps, but do not accumulate plaintext copies forever.
    try {
      const directory = new Directory(Paths.cache);
      const maxAge = 24 * 60 * 60 * 1000;
      for (const item of directory.list()) {
        if (!(item instanceof File) || !/^evrida-\d{4}-.*\.json$/.test(item.name)) continue;
        const modified = item.lastModified;
        if (modified !== null && Number.isFinite(modified) &&
          Date.now() - modified > maxAge) {
          try { item.delete(); } catch { /* OS may be sharing this file; retry on another export. */ }
        }
      }
    } catch { /* Cache cleanup must never prevent exporting the only recoverable backup. */ }
  }
  async function exportData() {
    if (!await Sharing.isAvailableAsync()) {
      throw new Error('Native sharing is unavailable. Export is not possible on this device.');
    }
    cleanupOldExports();
    const backup = await exportBackup(db);
    // Do not silently accumulate plaintext backups in the permanent Documents directory.
    const file = new File(Paths.cache, `evrida-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    // Serialize exactly as it was size-validated. Pretty-printing can inflate
    // a valid near-limit backup beyond the importer 10 MB safety limit.
    file.write(JSON.stringify(backup));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json',
      dialogTitle: 'Save your Evrida backup' });
    setNotice('Share sheet closed. Confirm you saved a copy in your chosen destination. A temporary file remains in app cache until a later cleanup.');
  }
  async function inspectHealth() {
    const result = await checkLocalHealth(db);
    setHealth(result);
    setNotice(result.structureOkay && result.foreignKeysOkay
      ? 'Local SQLite structure and relationships passed the read-only checks. This does not guarantee future app stability; keep an external backup.'
      : 'Possible local database inconsistency detected. Do not clear app storage; export a backup and contact support with the issue counts below.');
  }
  async function pickBackup() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = new File(picked.assets[0].uri);
    try {
      if ((file.size ?? 0) > MAX_BACKUP_BYTES) throw new Error('Choose an Evrida backup smaller than 10 MB.');
      const text = await file.text();
      const merge = await previewBackupMerge(db, text);
      const conflictNotice = merge.different
        ? `\n\nImportant: ${merge.different} records have the same ID but different local content (${merge.differentTables.join(', ')}). The LOCAL version wins. These incoming differences will NOT be imported.`
        : '';
      Alert.alert('Preview backup merge',
        `${merge.missing} missing records to add · ${merge.identical} already identical${conflictNotice}\n\nNo existing data will be deleted or overwritten. Active Focus timers are not included.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore missing', onPress: () => { void run(async () => {
          const count = await restoreBackup(db, text, merge);
          setNotice(`${count} missing record${count === 1 ? '' : 's'} restored. ${merge.different} differences kept their current local values.`);
        }); } },
      ]);
    } finally { if (file.exists) file.delete(); }
  }
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + dockInset }]}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to Plan" onPress={() => router.back()} style={styles.back}><ChevronLeft size={23} color={palette.foreground} strokeWidth={1.8} /></Pressable><Text style={[styles.title, { color: palette.foreground }]}>Your data & settings</Text></View>
      <Text style={[styles.copy, { color: palette.muted }]}>Your plans live on this device. Export a backup to keep them safe or move them.</Text>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.foreground }]}>Backup & restore</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>Goals, boards, schedules and recorded progress. Running focus timers are not included.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(exportData); }} style={[styles.primary, { backgroundColor: palette.accent, opacity: busy ? .5 : 1 }]}><Text style={{ color: palette.onAccent, fontWeight: '700' }}>{busy ? 'Working…' : 'Export backup'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(pickBackup); }} style={[styles.secondary, { borderColor: palette.border }]}><Text style={{ color: palette.foreground, fontWeight: '700' }}>Restore from a file</Text></Pressable>
        <Text style={[styles.caption, { color: palette.muted }]}>Exports are readable JSON shared from a temporary copy. Check that your chosen destination saved the file.</Text>
      </View>
      {notice ? <Text accessibilityRole="alert" style={[styles.copy, { color: palette.accent }]}>{notice}</Text> : null}
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.foreground }]}>Local data check</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>
          A read-only check of your local data. It changes nothing and is not a backup.
        </Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(inspectHealth); }}
          style={[styles.secondary, { borderColor: palette.border, opacity: busy ? 0.5 : 1 }]}>
          <Text style={{ color: palette.foreground, fontWeight: '700' }}>{busy ? 'Checking…' : 'Check local data'}</Text>
        </Pressable>
        {health ? <Text accessibilityRole="summary" style={[styles.caption, { color: palette.muted }]}>
          Structure: {health.structureOkay ? 'no issues found' : `${health.structuralProblems} issue(s)`} ·
          Relationships: {health.foreignKeysOkay ? 'no issues found' : `${health.orphanRelations} issue(s)`}
        </Text> : null}
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.foreground }]}>Focus alerts</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>{Platform.OS === 'ios' ? 'iOS' : 'Android'} controls notifications; Focus works with alerts off.{Platform.OS === 'android' ? ' On Android 14+ also allow Alarms & reminders under Special app access. Battery limits can delay alerts.' : ''}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => Alert.alert('Open system settings', 'Choose Evrida → Notifications in your device settings.')); }} style={[styles.secondary, { borderColor: palette.border }]}><Text style={{ color: palette.foreground }}>Open app settings</Text></Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.heading, { color: palette.foreground }]}>Private by design</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>No account, ads, analytics or cloud sync. Your goals and focus history stay on this device.</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>Your phone's own backups may include app data. Removing the app or clearing its storage deletes your plans, so export first.</Text>
        <Text style={[styles.caption, { color: palette.muted }]}>Evrida · {Constants.expoConfig?.version ?? '0.1.0'} · Every day with Evrida.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32, gap: 18 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }, title: { ...type.title, flex: 1 },
  heading: { ...type.heading }, copy: { fontSize: 14, lineHeight: 22 }, caption: { fontSize: 12, lineHeight: 19 },
  card: { padding: 18, borderRadius: 18, borderWidth: 1, gap: 14 }, primary: { minHeight: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  secondary: { minHeight: 50, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
