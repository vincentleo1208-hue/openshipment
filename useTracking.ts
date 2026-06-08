'use client';
// =============================================================
// OpenShipment — useTracking Hook
// Extracted from PublicSite handleTrackSearch()
// Hits real Supabase shipment_logs table via API route
// =============================================================
import { useState, useCallback } from 'react';
import type { Shipment, NotifyFn } from '@/types';

export function useTracking(notify: NotifyFn) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Shipment | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = query.trim().toUpperCase();
      if (!cleaned) return;

      setIsLoading(true);
      setHasSearched(true);

      try {
        const res = await fetch(`/api/shipments/${cleaned}`);
        if (res.status === 404) {
          setResult(null);
          notify(
            `Vận đơn ${cleaned} chưa tồn tại. Vui lòng đặt hàng trên openshipment.auto trước.`,
            'error',
          );
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as Shipment;
        setResult(data);
        notify(`Đã tìm thấy lịch trình cho vận đơn ${cleaned}`);
      } catch (err) {
        notify('Không thể kết nối hệ thống. Vui lòng thử lại.', 'error');
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [query, notify],
  );

  const reset = useCallback(() => {
    setResult(null);
    setHasSearched(false);
    setQuery('');
  }, []);

  return { query, setQuery, result, hasSearched, isLoading, search, reset };
}
