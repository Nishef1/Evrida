import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { useEvridaDatabase } from '../../storage/use-database';
import { getFocusSession, beginFocusSession, beginQuickFocus, pauseFocusSession, resumeFocusSession, stopFocusSession } from '../../storage/focus';
import type { FocusSession } from '../../domain/focus';
import { askForFocusNotificationPermission, reconcileFocusNotification } from './notifications';

interface FocusContextValue {
  session: FocusSession | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notificationNotice: string | null;
  refresh: () => Promise<void>;
  begin: (blockId: string, replace?: boolean) => Promise<void>;
  beginQuick: (goalId: string, minutes: number, replace?: boolean) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
}
const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const db = useEvridaDatabase();
  const [session, setSession] = useState<FocusSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);
  const blocked = useRef(false);
  const mounted = useRef(true);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const record = await getFocusSession(db);
      if (mounted.current && sequence === refreshSequence.current) {
        setSession(record);
        setLoading(false);
        setError(null);
        // Native reminders survive app restarts. Reconcile against SQLite,
        // including deleted/paused/expired sessions.
        void reconcileFocusNotification(db).then((notice) => {
          if (mounted.current && sequence === refreshSequence.current) setNotificationNotice(notice);
        }).catch((reason: unknown) => {
          if (mounted.current && sequence === refreshSequence.current) {
            const message = reason instanceof Error ? reason.message : String(reason);
            const specialPermission = Platform.OS === 'android' &&
              /exact.alarm|schedule.exact|securityexception|alarmmanager/i.test(message);
            setNotificationNotice(specialPermission
              ? 'Timer saved. To receive punctual alerts on Android, check Special app access → Alarms & reminders.'
              : 'Timer saved, but its background alert could not be scheduled. Check notification settings.');
          }
        });
      }
    } catch (reason) {
      if (mounted.current && sequence === refreshSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Could not read the focus timer.');
        setLoading(false);
      }
      throw reason;
    }
  }, [db]);

  useEffect(() => {
    mounted.current = true;
    void refresh().catch(() => { if (mounted.current) setLoading(false); });
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh().catch(() => {});
    });
    return () => { mounted.current = false; listener.remove(); };
  }, [refresh]);

  const perform = useCallback(async (action: () => Promise<FocusSession | null | void>) => {
    if (blocked.current) throw new Error('A focus action is already in progress.');
    blocked.current = true;
    setBusy(true);
    try {
      await action();
      await refresh();
    } finally {
      blocked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [refresh]);

  const begin = useCallback((blockId: string, replace = false) =>
    perform(async () => {
      // Permission prompts happen only after a Start action; denial is not fatal.
      try { await askForFocusNotificationPermission(); }
      catch { setNotificationNotice('Focus will run without a background alert.'); }
      return beginFocusSession(db, blockId, replace);
    }), [db, perform]);
  const pause = useCallback(() => perform(() => pauseFocusSession(db)), [db, perform]);
  const beginQuick = useCallback((goalId: string, minutes: number, replace = false) => perform(async () => {
    try { await askForFocusNotificationPermission(); }
    catch { setNotificationNotice('Focus will run without a background alert.'); }
    return beginQuickFocus(db, goalId, minutes, replace);
  }), [db, perform]);
  const resume = useCallback(() => perform(() => resumeFocusSession(db)), [db, perform]);
  const finish = useCallback(() => perform(() => stopFocusSession(db)), [db, perform]);

  const value = useMemo<FocusContextValue>(() => ({
    session, loading, busy, error, notificationNotice, refresh, begin, beginQuick, pause, resume, finish,
  }), [session, loading, busy, error, notificationNotice, refresh, begin, beginQuick, pause, resume, finish]);

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}
export function useFocusSession(): FocusContextValue {
  const result = useContext(FocusContext);
  if (!result) throw new Error('useFocusSession must be within FocusProvider.');
  return result;
}
