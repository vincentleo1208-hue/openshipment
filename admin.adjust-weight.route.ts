// =============================================================
// PATCH /api/admin/shipments/[id]/adjust-weight
// Replaces prototype savePhysicalMeasurements()
// Recalculates cost, flags surcharge, inserts audit log
// Uses service_role key to bypass RLS
// =============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase';
import { WeightAdjustSchema } from '@/lib/schemas';
import { calcFinalCost, SURCHARGE_THRESHOLD_VND } from '@/lib/price-engine';
import type { RawStatus } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const parsed = WeightAdjustSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Sai định dạng kích thước', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { actual_weight, length, width, height } = parsed.data;
  const supabase = createAdminSupabase();

  // 1. Fetch current shipment
  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('*')
    .eq('internal_tracking_id', params.id)
    .single();

  if (fetchError || !shipment) {
    return NextResponse.json({ error: 'Không tìm thấy vận đơn' }, { status: 404 });
  }

  // 2. Recalculate (server-side authoritative)
  const { volumetric_weight, chargeable_weight, final_cost } = calcFinalCost(
    shipment.destination_country,
    actual_weight,
    length,
    width,
    height,
  );

  const delta = final_cost - shipment.final_cost;
  const surcharge_triggered = delta > SURCHARGE_THRESHOLD_VND;
  const new_status: RawStatus = surcharge_triggered ? 'awaiting_surcharge' : 'arrived_at_hub';
  const surcharge_amount = surcharge_triggered ? delta : 0;

  // 3. Update shipment record
  const { data: updated, error: updateError } = await supabase
    .from('shipments')
    .update({
      actual_weight,
      length,
      width,
      height,
      volumetric_weight,
      chargeable_weight,
      final_cost,
      surcharge_amount,
      raw_status: new_status,
    })
    .eq('internal_tracking_id', params.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 4. Insert audit log (mirrors prototype newLog object)
  await supabase.from('shipment_logs').insert({
    shipment_id:       shipment.id,
    status:            'Đã hoàn tất cân đo bưu cục gốc',
    location:          'Hà Nội Hub, Vietnam',
    time:              new Date().toISOString(),
    description:       `Thông số kiểm định thực tế: Nặng ${actual_weight}kg, kích thước quy đổi ${volumetric_weight.toFixed(2)}kg. Trạng thái điều hành: ${surcharge_triggered ? 'Chờ bù cước thể tích' : 'Đạt chuẩn bay.'}`,
    raw_carrier_status: null,
  });

  return NextResponse.json({
    shipment: updated,
    recalculation: {
      volumetric_weight,
      chargeable_weight,
      new_cost: final_cost,
      delta,
      surcharge_triggered,
    },
  });
}
