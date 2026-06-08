'use client';
// =============================================================
// OpenShipment — useCalculator Hook
// Extracted from PublicSite handleCalculate()
// All pricing logic lives in price-engine.ts — hook is UI glue
// =============================================================
import { useState, useCallback } from 'react';
import { buildEstimatedRates } from '@/lib/price-engine';
import { CalculatorParamsSchema } from '@/lib/schemas';
import type { CalculatorParams, EstimatedRates, NotifyFn } from '@/types';

const DEFAULT_PARAMS: CalculatorParams = {
  destination: 'USA',
  weight: 1.5,
  length: 25,
  width: 20,
  height: 15,
  commodity: 'General',
};

export function useCalculator(notify: NotifyFn) {
  const [params, setParams] = useState<CalculatorParams>(DEFAULT_PARAMS);
  const [rates, setRates] = useState<EstimatedRates | null>(null);

  const updateParam = useCallback(
    <K extends keyof CalculatorParams>(key: K, value: CalculatorParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
      setRates(null); // Reset result when inputs change
    },
    [],
  );

  const calculate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsed = CalculatorParamsSchema.safeParse(params);
      if (!parsed.success) {
        const firstError = parsed.error.errors[0]?.message;
        notify(firstError ?? 'Vui lòng nhập đầy đủ thông số.', 'error');
        return;
      }
      const result = buildEstimatedRates(parsed.data);
      setRates(result);
      notify('Đã tính cước dựa trên biểu giá bưu tá quốc tế cập nhật hôm nay.');
    },
    [params, notify],
  );

  return { params, updateParam, rates, calculate };
}
