// =============================================================
// OpenShipment — Price Engine
// Extracted from prototype handleCalculate() and checkout pricing
// All business logic lives here, not in components
// =============================================================
import type { DestinationKey, DestinationRule, EstimatedRates, CalculatorParams } from '@/types';

// ─── Destination Matrix ────────────────────────────────────────
// Source of truth for all pricing. Matches prototype DESTINATIONS constant
// but typed and centralized so both public site and admin use the same numbers.

export const DESTINATION_RULES: Record<DestinationKey, DestinationRule> = {
  USA: {
    name: 'Hoa Kỳ (Mỹ)',
    divisor: 6000,
    rate_per_kg: 220000,
    dhl_retail_per_kg: 380000,
    fedex_retail_per_kg: 360000,
    local_tip: 'Nên dùng USPS Direct để tránh thủ tục rườm rà tại Mỹ.',
  },
  Australia: {
    name: 'Australia (Úc)',
    divisor: 6000,
    rate_per_kg: 240000,
    dhl_retail_per_kg: 410000,
    fedex_retail_per_kg: 390000,
    local_tip: 'Hải quan Úc kiểm dịch thực vật rất nghiêm ngặt.',
  },
  Germany: {
    name: 'Đức (Tuyến EU)',
    divisor: 6000,
    rate_per_kg: 260000,
    dhl_retail_per_kg: 440000,
    fedex_retail_per_kg: 420000,
    local_tip: 'Yêu cầu mã IOSS nếu gửi hàng e-commerce giá trị thấp.',
  },
  Japan: {
    name: 'Nhật Bản',
    divisor: 7000,
    rate_per_kg: 160000,
    dhl_retail_per_kg: 290000,
    fedex_retail_per_kg: 270000,
    local_tip: 'Thời gian thông quan nhanh, tuyến bay hàng ngày.',
  },
  Singapore: {
    name: 'Singapore',
    divisor: 7000,
    rate_per_kg: 120000,
    dhl_retail_per_kg: 210000,
    fedex_retail_per_kg: 195000,
    local_tip: 'Tối ưu tuyệt đối về chi phí cho hàng bưu phẩm nhỏ.',
  },
};

// ─── Loyalty Tier Discounts ────────────────────────────────────
// Matches prototype discount logic in handleCalculate() exactly

export interface TierResult {
  multiplier: number;
  label: string;
}

export function getTierDiscount(chargeableWeight: number): TierResult {
  if (chargeableWeight >= 5 && chargeableWeight <= 20) {
    return { multiplier: 0.95, label: 'Ưu đãi Hội viên Bạc (Giảm 5%)' };
  }
  if (chargeableWeight > 20 && chargeableWeight <= 100) {
    return { multiplier: 0.90, label: 'Hội viên Vàng - Nhà bán chuyên nghiệp (Giảm 10%)' };
  }
  if (chargeableWeight > 100) {
    return { multiplier: 0.85, label: 'Hội viên Kim Cương - Doanh nghiệp xuất khẩu (Giảm 15%)' };
  }
  return { multiplier: 1, label: 'Standard' };
}

// ─── Core Calculation Functions ────────────────────────────────

export function calcVolumetricWeight(
  length: number,
  width: number,
  height: number,
  divisor: number,
): number {
  return parseFloat(((length * width * height) / divisor).toFixed(2));
}

export function calcChargeableWeight(
  actualWeight: number,
  volumetricWeight: number,
): number {
  return Math.max(actualWeight, volumetricWeight);
}

// DHL/FedEx use standard divisor of 5000, not the economy divisor
export function buildEstimatedRates(params: CalculatorParams): EstimatedRates {
  const dest = DESTINATION_RULES[params.destination];
  const volWeight = calcVolumetricWeight(params.length, params.width, params.height, dest.divisor);
  const chargeableWeight = calcChargeableWeight(params.weight, volWeight);
  const { multiplier, label } = getTierDiscount(chargeableWeight);

  // Competitor rates always use standard 5000 divisor
  const competitorChargeableWeight = calcChargeableWeight(
    params.weight,
    calcVolumetricWeight(params.length, params.width, params.height, 5000),
  );

  return {
    volumetric_weight: volWeight,
    chargeable_weight: chargeableWeight,
    system_cost: Math.round(chargeableWeight * dest.rate_per_kg * multiplier),
    dhl_cost: Math.round(competitorChargeableWeight * dest.dhl_retail_per_kg),
    fedex_cost: Math.round(competitorChargeableWeight * dest.fedex_retail_per_kg),
    discount_applied: label,
    divisor_used: dest.divisor,
    local_tip: dest.local_tip,
  };
}

export function calcFinalCost(
  destination: DestinationKey,
  actualWeight: number,
  length: number,
  width: number,
  height: number,
): { volumetric_weight: number; chargeable_weight: number; final_cost: number } {
  const dest = DESTINATION_RULES[destination];
  const volWeight = calcVolumetricWeight(length, width, height, dest.divisor);
  const chargeableWeight = calcChargeableWeight(actualWeight, volWeight);
  const { multiplier } = getTierDiscount(chargeableWeight);
  return {
    volumetric_weight: volWeight,
    chargeable_weight: chargeableWeight,
    final_cost: Math.round(chargeableWeight * dest.rate_per_kg * multiplier),
  };
}

// ─── Compliance Rules ──────────────────────────────────────────

export const COMPLIANCE_ALERTS: Partial<Record<string, string[]>> = {
  Food: [
    'Không có thịt gia súc, gia cầm hoặc trứng dạng lỏng.',
    'Sản phẩm thực phẩm khô phải được dán nhãn thành phần đầy đủ.',
    'Hút chân không tốt và đóng gói sạch sẽ.',
    'Hệ thống hỗ trợ soạn tờ khai hải quan bưu điện miễn phí.',
  ],
  Cosmetics: [
    'Đóng gói dạng gel/chất lỏng phải quấn màng xốp bong bóng khí.',
    'Lọ son, serum cần được cố định tránh va đập mạnh.',
    'Không chứa thủy ngân, chì, hay các chất cấm.',
  ],
};

// ─── Format Helpers ────────────────────────────────────────────

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(2)} kg`;
}

export function buildCheckoutURL(params: CalculatorParams): string {
  const query = new URLSearchParams({
    dest: params.destination,
    wt: String(params.weight),
    l: String(params.length),
    w: String(params.width),
    h: String(params.height),
    cat: params.commodity,
  });
  return `https://openshipment.auto/checkout?${query.toString()}`;
}

export function parseCheckoutURL(searchParams: URLSearchParams): Partial<CalculatorParams> {
  return {
    destination: (searchParams.get('dest') as DestinationKey) ?? 'USA',
    weight: parseFloat(searchParams.get('wt') ?? '1'),
    length: parseFloat(searchParams.get('l') ?? '10'),
    width: parseFloat(searchParams.get('w') ?? '10'),
    height: parseFloat(searchParams.get('h') ?? '10'),
    commodity: (searchParams.get('cat') as any) ?? 'General',
  };
}

// ─── Status Display Helpers ────────────────────────────────────

export const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending:            { label: 'Chờ gom hàng',     color: 'bg-amber-500/10 text-amber-400' },
  arrived_at_hub:     { label: 'Đã nhập kho',       color: 'bg-amber-500/10 text-amber-400' },
  awaiting_surcharge: { label: 'Lệch thể tích',     color: 'bg-rose-500/10 text-rose-400' },
  in_transit:         { label: 'Đang đi liên bưu',  color: 'bg-blue-500/10 text-blue-400' },
  delivered:          { label: 'Đã giao hàng',      color: 'bg-emerald-500/10 text-emerald-400' },
  returned:           { label: 'Trả về người gửi',  color: 'bg-slate-500/10 text-slate-400' },
  exception:          { label: 'Ngoại lệ / Giữ lại', color: 'bg-red-500/10 text-red-400' },
};

export const SURCHARGE_THRESHOLD_VND = 50_000;
