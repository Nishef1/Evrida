import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const KEY = 'evrida.learning.reminder';
const MARKER = 'evrida-learning-review';
const CHANNEL = 'evrida-learning';

/** `weekday` uses the notification convention: 1 = Sunday … 7 = Saturday. The choice is a per-device preference, not backed-up data. */
export interface ReminderPref { weekday: number; hour: number }
export const WEEKDAYS: { weekday: number; label: string }[] = [
  { weekday: 2, label: 'Mon' }, { weekday: 3, label: 'Tue' }, { weekday: 4, label: 'Wed' }, { weekday: 5, label: 'Thu' },
  { weekday: 6, label: 'Fri' }, { weekday: 7, label: 'Sat' }, { weekday: 1, label: 'Sun' },
];
export const REMINDER_HOURS = [9, 12, 18, 20, 21];
export const reminderText = (p: ReminderPref) => `${WEEKDAYS.find((d) => d.weekday === p.weekday)?.label ?? ''} ${String(p.hour).padStart(2, '0')}:00`;

export async function getReminder(): Promise<ReminderPref | null> {
  try {
    const raw = await Storage.getItemAsync(KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value && Number.isInteger(value.weekday) && value.weekday >= 1 && value.weekday <= 7 && Number.isInteger(value.hour) && value.hour >= 0 && value.hour < 24 ? value : null;
  } catch { return null; }
}

async function pending() {
  return (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.content.data?.evridaMarker === MARKER);
}
async function cancelAll() { for (const n of await pending()) await Notifications.cancelScheduledNotificationAsync(n.identifier); }
const allowed = (p: Notifications.NotificationPermissionsStatus) => p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

async function schedule(pref: ReminderPref): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Weekly learning review', importance: Notifications.AndroidImportance.DEFAULT });
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Weekly learning review', body: 'How well do you know your topics now? Rate them in Evrida.', data: { evridaMarker: MARKER } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: pref.weekday, hour: pref.hour, minute: 0,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
  });
}

/** Turn the weekly reminder on (or off with null). Throws a readable message when the OS will not deliver notifications. */
export async function setReminder(pref: ReminderPref | null): Promise<void> {
  if (!pref) { await cancelAll(); await Storage.removeItemAsync(KEY); return; }
  let permission = await Notifications.getPermissionsAsync();
  if (!allowed(permission) && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!allowed(permission)) throw new Error('Notifications are off for Evrida. Enable them in system settings to get a weekly reminder.');
  await cancelAll();
  await schedule(pref);
  await Storage.setItemAsync(KEY, JSON.stringify(pref));
}

/** Re-arm after a force-stop or reboot may have dropped the OS alarm. Quiet when nothing is configured or allowed. */
export async function resyncReminder(): Promise<void> {
  try {
    const pref = await getReminder();
    if (!pref) return;
    if (!allowed(await Notifications.getPermissionsAsync())) { await cancelAll(); return; }
    if ((await pending()).length !== 1) { await cancelAll(); await schedule(pref); }
  } catch { /* a reminder failure must never break the Learning screen */ }
}
