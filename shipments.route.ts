// =============================================================
// POST /api/shipments
// Creates a new shipment — replaces prototype executeBookingFulfillment()
// Generates OS-XXXXXX via DB function, inserts initial log
// =============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { CreateShipmentSchema } from '@/lib/schemas';
import { calcFinalCost } from '@/lib/price-engine';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateShipmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dữ liệu không hợp lệ', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const supabase = createServerSupabase();

  // 1. Calculate pricing server-side (authoritative — never trust client)
  const { volumetric_weight, chargeable_weight, final_cost } = calcFinalCost(
    data.destination_country,
    data.actual_weight,
    data.length,
    data.width,
    data.height,
  );

  // 2. Generate unique OS-XXXXXX tracking ID
  const { data: trackingIdResult, error: idError } = await supabase
    .rpc('generate_tracking_id');

  if (idError || !trackingIdResult) {
    return NextResponse.json({ error: 'Không thể tạo mã vận đơn' }, { status: 500 });
  }

  const internal_tracking_id = trackingIdResult as string;

  // 3. Determine carrier based on destination
  const carrier_name = data.destination_country === 'USA'
    ? 'USPS_Injection'
    : 'VNPost_Priority';

  // 4. Insert shipment
  const { data: shipment, error: insertError } = await supabase
    .from('shipments')
    .insert({
      internal_tracking_id,
      customer_id:         data.customer_id ?? null,
      customer_name:       data.sender_name,
      sender_phone:        data.sender_phone,
      sender_address:      data.sender_address,
      receiver_name:       data.receiver_name,
      receiver_phone:      data.receiver_phone,
      receiver_address:    data.receiver_address,
      destination_country: data.destination_country,
      commodity_type:      data.commodity_type,
      commodity_detail:    data.commodity_detail,
      declared_value:      data.declared_value,
      declared_weight:     data.declared_weight,
      actual_weight:       data.actual_weight,
      length:              data.length,
      width:               data.width,
      height:              data.height,
      volumetric_weight,
      chargeable_weight,
      final_cost,
      surcharge_amount:    0,
      raw_status:          'pending',
      carrier_name,
      vendor_tracking_id:  null,
    })
    .select()
    .single();

  if (insertError || !shipment) {
    console.error('[POST /api/shipments]', insertError);
    return NextResponse.json({ error: 'Không thể tạo đơn hàng' }, { status: 500 });
  }

  // 5. Insert initial log entry (mirrors prototype logs[0])
  await supabase.from('shipment_logs').insert({
    shipment_id:       shipment.id,
    status:            'Khởi tạo bưu gửi thành công',
    location:          'Hệ thống tự động',
    time:              new Date().toISOString(),
    description:       'Thông tin bưu phẩm đã khớp định dạng và thanh toán bưu cục được xác nhận bưu chính.',
    raw_carrier_status: null,
  });

  return NextResponse.json({ shipment }, { status: 201 });
}
