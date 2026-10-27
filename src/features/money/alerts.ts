import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import { pendingBudgetAlerts } from '../../domain/finance';
import type { FinanceSnapshot } from '../../storage/finance';

const ON_KEY = 'evrida.money.alerts';
const SENT_KEY = 'evrida.money.alerts.sent';
const CHANNEL = 'evrida-budget';
const allowed = (p: Notifications.NotificationPermissionsStatus) => p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

export async function budgetAlertsOn(): Promise<boolean> {
  try { return (await Storage.getItemAsync(ON_KEY)) === '1'; } catch { return false; }
}

/** Opt-in. Turning it on asks for notification permission and throws a readable message if it is refused. */
export async function setBudgetAlerts(on: boolean): Promise<void> {
  if (!on) { await Storage.removeItemAsync(ON_KEY); return; }
  let permission = await Notifications.getPermissionsAsync();
  if (!allowed(permission) && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!allowed(permission)) throw new Error('Notifications are off for Evrida. Enable them in system settings to get budget alerts.');
  await Storage.setItemAsync(ON_KEY, '1');
}

/**
 * Show one local notification the first time a budget reaches 80% or goes over in a month. Amounts are never put in
 * the notification text (lock screens are visible to others). Quiet when off, not permitted, or already notified.
 */
export async function checkBudgetAlerts(data: FinanceSnapshot, today: string): Promise<void> {
  try {
    if (!(await budgetAlertsOn())) return;
    if (!allowed(await Notifications.getPermissionsAsync())) return;
    let sent: string[] = [];
    try { sent = JSON.parse((await Storage.getItemAsync(SENT_KEY)) ?? '[]'); } catch { sent = []; }
    const due = pendingBudgetAlerts(data.budgets, data.categories, data.txs, today.slice(0, 7), new Set(sent));
    if (!due.length) return;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Budget alerts', importance: Notifications.AndroidImportance.DEFAULT });
    for (const alert of due) {
      await Notifications.scheduleNotificationAsync({
        content: { title: alert.state === 'over' ? 'A budget is over' : 'A budget is almost used', body: `${alert.label}. Open Money to review.`, data: { evridaMarker: 'evrida-budget' } },
        trigger: Platform.OS === 'android' ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: CHANNEL } : null,
      });
    }
    // Keep only this month's keys so the list cannot grow without bound.
    const month = today.slice(0, 7);
    await Storage.setItemAsync(SENT_KEY, JSON.stringify([...sent.filter((k) => k.startsWith(month)), ...due.map((d) => d.key)]));
  } catch { /* an alert failure must never break Money */ }
}
