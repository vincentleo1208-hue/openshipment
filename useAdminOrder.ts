'use client';
// =============================================================
// OpenShipment — useAdminOrder Hook
// Extracted from AdminCommand savePhysicalMeasurements()
//                          and saveVendorTrackingMap()
// Hits real API routes instead of mutating local state
// =============================================================
import { useState, useCallback } from 'react';
import { WeightAdjustSchema, VendorTrackingSchema } from '@/lib/schemas';
import { DESTINATION_RULES, calcVolumetricWeight, calcChargeableWeight, getTierDiscount, SURCHARGE_THRESHOLD_VND } from '@/lib/price-engine';
import type { Shipment, CarrierName, NotifyFn } from '@/types';

export function useAdminOrder(
  shipments: Shipment[],
  setShipments: (s: Shipment[]) => void,
  notify: NotifyFn,
) {
  const [selectedOrder, setSelectedOrder] = useState<Shipment | null>(null);

  // Weight form
  const [actualWeightInput, setActualWeightInput] = useState('');
  const [lInput, setLInput] = useState('');
  const [wInput, setWInput] = useState('');
  const [hInput, setHInput] = useState('');

  // Carrier form
  const [vendorCarrierInput, setVendorCarrierInput] = useState<CarrierName>('USPS_Injection');
  const [vendorTrackingInput, setVendorTrackingInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const selectOrder = useCallback((ord: Shipment) => {
    setSelectedOrder(ord);
    setActualWeightInput(String(ord.actual_weight));
    setLInput(String(ord.length));
    setWInput(String(ord.width));
    setHInput(String(ord.height));
    setVendorCarrierInput(ord.carrier_name);
    setVendorTrackingInput(ord.vendor_tracking_id ?? '');
  }, []);

  // ─── Live recalculation preview ────────────────────────────
  // Mirrors savePhysicalMeasurements logic for real-time feedback
  const liveRecalc = useCallback(() => {
    if (!selectedOrder) return null;
    const w = parseFloat(actualWeightInput);
    const l = parseFloat(lInput);
    const wd = parseFloat(wInput);
    const h = parseFloat(hInput);
    if ([w, l, wd, h].some(isNaN)) return null;

    const dest = DESTINATION_RULES[selectedOrder.destination_country];
    const volWeight = calcVolumetricWeight(l, wd, h, dest.divisor);
    const chargeableWeight = calcChargeableWeight(w, volWeight);
    const { multiplier } = getTierDiscount(chargeableWeight);
    const newCost = Math.round(chargeableWeight * dest.rate_per_kg * multiplier);
    const delta = newCost - selectedOrder.final_cost;

    return {
      volumetric_weight: volWeight,
      chargeable_weight: chargeableWeight,
      new_cost: newCost,
      delta,
      surcharge_triggered: delta > SURCHARGE_THRESHOLD_VND,
    };
  }, [selectedOrder, actualWeightInput, lInput, wInput, hInput]);

  // ─── Save physical measurements ────────────────────────────
  const savePhysicalMeasurements = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOrder) return;

      const parsed = WeightAdjustSchema.safeParse({
        actual_weight: parseFloat(actualWeightInput),
        length: parseFloat(lInput),
        width: parseFloat(wInput),
        height: parseFloat(hInput),
      });

      if (!parsed.success) {
        notify(parsed.error.errors[0]?.message ?? 'Sai định dạng kích thước, vui lòng xem lại', 'error');
        return;
      }

      setIsSaving(true);
      try {
        const res = await fetch(
          `/api/admin/shipments/${selectedOrder.internal_tracking_id}/adjust-weight`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          },
        );
        if (!res.ok) throw new Error(await res.text());
        const { shipment, recalculation } = await res.json();

        // Update local list optimistically
        setShipments(shipments.map((s) =>
          s.internal_tracking_id === selectedOrder.internal_tracking_id ? shipment : s,
        ));
        setSelectedOrder(shipment);

        if (recalculation.surcharge_triggered) {
          notify(
            `⚠️ Báo động: Bưu kiện lớn hơn khai báo! Đã phát sinh phụ phí ${recalculation.delta.toLocaleString()} VND.`,
            'warning',
          );
        } else {
          notify('Đã cân đo vật lý hợp lệ bưu gửi trung chuyển.');
        }
      } catch {
        notify('Không thể lưu thông số. Vui lòng thử lại.', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedOrder, actualWeightInput, lInput, wInput, hInput, shipments, setShipments, notify],
  );

  // ─── Save vendor tracking map ───────────────────────────────
  const saveVendorTrackingMap = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOrder) return;

      const parsed = VendorTrackingSchema.safeParse({
        carrier_name: vendorCarrierInput,
        vendor_tracking_id: vendorTrackingInput,
      });

      if (!parsed.success) {
        notify(parsed.error.errors[0]?.message ?? 'Mã vận đơn liên bưu không hợp lệ.', 'error');
        return;
      }

      setIsSaving(true);
      try {
        const res = await fetch(
          `/api/admin/shipments/${selectedOrder.internal_tracking_id}/vendor-tracking`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          },
        );
        if (!res.ok) throw new Error(await res.text());
        const { shipment } = await res.json();

        setShipments(shipments.map((s) =>
          s.internal_tracking_id === selectedOrder.internal_tracking_id ? shipment : s,
        ));
        setSelectedOrder(null);
        notify(`Đã tích hợp mã hải quan thế giới ${parsed.data.vendor_tracking_id} thành công.`);
      } catch {
        notify('Không thể áp mã vận đơn. Vui lòng thử lại.', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedOrder, vendorCarrierInput, vendorTrackingInput, shipments, setShipments, notify],
  );

  return {
    selectedOrder,
    selectOrder,
    deselect: () => setSelectedOrder(null),
    // weight form
    actualWeightInput, setActualWeightInput,
    lInput, setLInput,
    wInput, setWInput,
    hInput, setHInput,
    liveRecalc,
    savePhysicalMeasurements,
    // carrier form
    vendorCarrierInput, setVendorCarrierInput,
    vendorTrackingInput, setVendorTrackingInput,
    saveVendorTrackingMap,
    isSaving,
  };
}
