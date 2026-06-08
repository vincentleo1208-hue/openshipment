// =============================================================
// PATCH /api/admin/shipments/[id]/vendor-tracking
// Replaces prototype saveVendorTrackingMap()
// Maps raw carrier barcode to shipment, advances status
// Registers with TrackingMore/EasyPost for automatic updates
// =============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase';
import { VendorTrackingSchema } from '@/lib/schemas';
import { registerShipmentWithCarrier } from '@/lib/carrier-registration';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const parsed = VendorTrackingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dữ liệu không hợp lệ', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { carrier_name, vendor_tracking_id } = parsed.data;
  const supabase = createAdminSupabase();

  // 1. Fetch shipment to get DB uuid
  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('id, internal_tracking_id, carrier_name, vendor_tracking_id')
    .eq('internal_tracking_id', params.id)
    .single();

  if (fetchError || !shipment) {
    return NextResponse.json({ error: 'Không tìm thấy vận đơn' }, { status: 404 });
  }

  // 2. Update carrier info and advance to in_transit
  const { data: updated, error: updateError } = await supabase
    .from('shipments')
    .update({
      carrier_name,
      vendor_tracking_id,
      raw_status: 'in_transit',
    })
    .eq('internal_tracking_id', params.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 3. Insert log (mirrors prototype newLog in saveVendorTrackingMap)
  await supabase.from('shipment_logs').insert({
    shipment_id:       shipment.id,
    status:            'Đã giao bưu tá liên tuyến không lưu',
    location:          'Kho bưu phẩm quốc tế Nội Bài',
    time:              new Date().toISOString(),
    description:       `Bưu kiện đã dán mã bưu chính toàn cầu thông quan của ${carrier_name}. Mã theo dõi quốc tế: ${vendor_tracking_id}.`,
    raw_carrier_status: null,
  });

  // 4. Register with external tracking service (TrackingMore/EasyPost)
  const preferredProvider = (process.env.TRACKING_PROVIDER as 'trackingmore' | 'easypost') ?? 'trackingmore';
  const registration = await registerShipmentWithCarrier(
    vendor_tracking_id,
    carrier_name,
    preferredProvider
  );

  if (!registration.success) {
    console.warn('Failed to register with carrier:', registration.error);
    // Don't fail the request - tracking will still work via webhooks
    // But include warning in response for ops team
    return NextResponse.json({
      shipment: updated,
      tracking_registration: registration,
      warning: 'Không thể đăng ký theo dõi với nhà cung cấp. Vui lòng kiểm tra cấu hình API.',
    });
  }

  return NextResponse.json({
    shipment: updated,
    tracking_registration: registration,
  });
}
