// =============================================================
// GET /api/shipments/[trackingId]
// Public tracking lookup — replaces prototype handleTrackSearch()
// Returns shipment + logs. Never exposes raw_carrier_status.
// =============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { trackingId: string } },
) {
  const { trackingId } = params;

  // Validate format OS-XXXXXX
  if (!/^OS-[A-Z0-9]{6}$/.test(trackingId.toUpperCase())) {
    return NextResponse.json(
      { error: 'Định dạng mã vận đơn không hợp lệ' },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();

  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(`
      *,
      logs:shipment_logs (
        id, shipment_id, status, location, time, description, created_at
        -- raw_carrier_status intentionally excluded from select
      )
    `)
    .eq('internal_tracking_id', trackingId.toUpperCase())
    .order('time', { referencedTable: 'shipment_logs', ascending: false })
    .single();

  if (error || !shipment) {
    return NextResponse.json(
      { error: 'Không tìm thấy vận đơn' },
      { status: 404 },
    );
  }

  return NextResponse.json(shipment, { status: 200 });
}
