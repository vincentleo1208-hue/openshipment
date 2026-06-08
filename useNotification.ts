'use client';
// =============================================================
// OpenShipment — useNotification Hook
// Extracted from App notify() and activeNotification state
// =============================================================
import { useState, useCallback } from 'react';
import type { Notification, NotifyFn } from '@/types';

export function useNotification(): { notification: Notification | null; notify: NotifyFn } {
  const [notification, setNotification] = useState<Notification | null>(null);

  const notify: NotifyFn = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  return { notification, notify };
}
