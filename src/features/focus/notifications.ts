import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getFocusSession } from '../../storage/focus';

const CHANNEL = 'evrida-focus';
const MARKER = 'evrida-focus-expiry';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function prepareChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Focus completion',
    importance: Notifications.AndroidImportance.HIGH,
    // Omitting sound selects Android's default notification sound. A string
    // here is interpreted as a custom raw resource filename by the channel API.
  });
}
function permitted(permissions: Notifications.NotificationPermissionsStatus): boolean {
  return permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Only prompt after Start is tapped. A denial never prevents the timer from running. */
export async function askForFocusNotificationPermission(): Promise<void> {
  await prepareChannel();
  const current = await Notifications.getPermissionsAsync();
  // Android's notifications wrapper reports DENIED while system notifications
  // are disabled, including a fresh install that has never shown the prompt.
  if (!permitted(current) && current.canAskAgain &&
      (Platform.OS === 'android' || current.status === Notifications.PermissionStatus.UNDETERMINED)) {
    await Notifications.requestPermissionsAsync();
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Reconcile from the actual SQLite state, never a stale React snapshot.
 * The OS owns delivery while the app is closed. A persisted running session
 * survives a restart. Re-arm its reminder: Android force-stop can remove the
 * actual OS alarm while the notifications module still retains its request.
 */
export function reconcileFocusNotification(db: SQLiteDatabase): Promise<string | null> {
  const work = queue.catch(() => {}).then(async () => {
    await prepareChannel();
    const pending = (await Notifications.getAllScheduledNotificationsAsync()).filter(
      (item) => item.content.data?.evridaMarker === MARKER,
    );
    const session = await getFocusSession(db);
    const needsReminder = session?.status === 'running' && session.deadlineMs > Date.now();
    // Permissions can be revoked while the app is backgrounded, even if an
    // older reminder was already queued. Validate before trusting a match.
    const permissions = needsReminder ? await Notifications.getPermissionsAsync() : null;
    const allowed = !!permissions && permitted(permissions);
    if (!needsReminder || !allowed) {
      for (const item of pending) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
      if (!needsReminder) return null;
      return 'Background Focus alerts are off. Enable notifications in system settings.';
    }
    // Keep the last scheduled alarm until its replacement is safely created.
    // Android may refuse exact alarms; cancelling first could silently lose an
    // otherwise valid reminder if the new native schedule call fails.
    let newIdentifier: string;
    try {
      newIdentifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Focus time is up',
        body: 'Your timebox has ended. Return to Evrida to review your session.',
        sound: 'default',
        data: {
          evridaMarker: MARKER,
          focusBlockId: session.blockId,
          deadlineMs: String(session.deadlineMs),
        },
      },
      trigger: Platform.OS === 'android'
        ? { type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(session.deadlineMs), channelId: CHANNEL }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(session.deadlineMs) },
      });
    } catch (reason) {
      // An old session's deadline is *never* an acceptable fallback for a
      // replaced/paused/resumed Focus. Only an identical current reminder may
      // survive failure to re-arm it.
      for (const item of pending) {
        if (item.content.data?.focusBlockId !== session.blockId ||
          item.content.data?.deadlineMs !== String(session.deadlineMs)) {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
        }
      }
      throw reason;
    }
    for (const item of pending) {
      if (item.identifier !== newIdentifier)
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
    return null;
  });
  queue = work.then(() => undefined, () => undefined);
  return work;
}
