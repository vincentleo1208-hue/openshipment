'use client';
// =============================================================
// OpenShipment — useCheckout Hook
// Extracted from CheckoutWizard executeBookingFulfillment()
// Drives the 3-step wizard with real API submission
// =============================================================
import { useState, useCallback } from 'react';
import { CheckoutStep1Schema, CheckoutStep2Schema } from '@/lib/schemas';
import { calcFinalCost } from '@/lib/price-engine';
import type {
  CalculatorParams,
  CheckoutStep1Input,
  CheckoutStep2Input,
  Shipment,
  NotifyFn,
} from '@/types';

export function useCheckout(
  params: CalculatorParams,
  notify: NotifyFn,
  onSuccess: (trackingId: string) => void,
) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 state
  const [step1, setStep1] = useState<CheckoutStep1Input>({
    sender_name: 'Nguyễn Văn Minh',
    sender_phone: '0912345678',
    sender_address: '12 Cầu Giấy, Láng Thượng, Hà Nội',
    receiver_name: '',
    receiver_phone: '',
    receiver_address: '',
    is_address_validated: false,
  });

  // Step 2 state
  const [step2, setStep2] = useState<CheckoutStep2Input>({
    commodity_detail: '',
    declared_value: 100,
  });

  // Pricing (derived, not stored)
  const pricing = calcFinalCost(
    params.destination,
    params.weight,
    params.length,
    params.width,
    params.height,
  );

  // Address autocomplete simulation — replace with real Google Places API
  const validateAddress = useCallback(() => {
    if (!step1.receiver_address) {
      notify('Vui lòng điền nội dung địa chỉ để trợ lý bưu điện kiểm tra.', 'error');
      return;
    }
    const destFormats: Record<string, string> = {
      USA:       ', Austin, TX 78701, United States',
      Australia: ', Sydney, NSW 2000, Australia',
      Germany:   ', Frankfurt, 60311, Germany',
      Japan:     ', Tokyo, 100-0001, Japan',
      Singapore: ', Singapore, 018956, Singapore',
    };
    const suffix = destFormats[params.destination] ?? '';
    const alreadyFormatted = step1.receiver_address.toLowerCase().includes(
      params.destination.toLowerCase(),
    );
    const formatted = alreadyFormatted
      ? step1.receiver_address
      : `${step1.receiver_address}${suffix}`;

    setStep1((prev) => ({
      ...prev,
      receiver_address: formatted,
      is_address_validated: true,
    }));
    notify('Địa chỉ đã được trợ lý định dạng tự động bám sát tiêu chuẩn bưu chính thế giới.');
  }, [step1.receiver_address, params.destination, notify]);

  const proceedToStep2 = useCallback(() => {
    const parsed = CheckoutStep1Schema.safeParse(step1);
    if (!parsed.success) {
      notify(parsed.error.errors[0]?.message ?? 'Vui lòng điền đầy đủ thông tin.', 'error');
      return;
    }
    setStep(2);
  }, [step1, notify]);

  const proceedToStep3 = useCallback(() => {
    const parsed = CheckoutStep2Schema.safeParse(step2);
    if (!parsed.success) {
      notify(parsed.error.errors[0]?.message ?? 'Vui lòng điền mô tả hàng hóa.', 'error');
      return;
    }
    setStep(3);
  }, [step2, notify]);

  const submitBooking = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        sender_name:         step1.sender_name,
        sender_phone:        step1.sender_phone,
        sender_address:      step1.sender_address,
        receiver_name:       step1.receiver_name,
        receiver_phone:      step1.receiver_phone,
        receiver_address:    step1.receiver_address,
        destination_country: params.destination,
        commodity_type:      params.commodity,
        commodity_detail:    step2.commodity_detail,
        declared_value:      step2.declared_value,
        declared_weight:     params.weight,
        actual_weight:       params.weight,
        length:              params.length,
        width:               params.width,
        height:              params.height,
      };

      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { shipment: Shipment };
      notify(`Chúc mừng! Vận đơn ${data.shipment.internal_tracking_id} đã lên thành công bưu chuyến bay.`);
      onSuccess(data.shipment.internal_tracking_id);
    } catch {
      notify('Không thể tạo đơn hàng. Vui lòng thử lại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [step1, step2, params, notify, onSuccess]);

  return {
    step, setStep,
    step1, setStep1,
    step2, setStep2,
    pricing,
    validateAddress,
    proceedToStep2,
    proceedToStep3,
    submitBooking,
    isSubmitting,
  };
}
