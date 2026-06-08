// =============================================================
// POST /api/webhooks/carrier
// Absorbs raw TrackingMore / EasyPost webhook payloads
// Normalizes → stores log → advances shipment status
// raw_carrier_status stored for audit, never returned to client
// =============================================================
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase';
import { CarrierWebhookSchema } from '@/lib/schemas';
import { normalizeCarrierStatus, normalizeTimestamp, isProgression } from '@/lib/tracking-normalizer';
import type { RawStatus } from '@/types';

const WEBHOOK_SECRET = process.env.CARRIER_WEBHOOK_SECRET ?? '';

export async function POST(req: NextRequest) {
  // Signature check (HMAC-SHA256 in production)
  const sig = req.headers.get('x-trackingmore-signature')
    ?? req.headers.get('x-easypost-hmac-sha256')
    ?? '';

  if (WEBHOOK_SECRET && sig !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CarrierWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { vendor_tracking_id, carrier_code, status, location, timestamp } = parsed.data;
  const supabase = createAdminSupabase();

  // 1. Lookup shipment by vendor_tracking_id
  const { data: shipment, error: lookupError } = await supabase
    .from('shipments')
    .select('id, internal_tracking_id, raw_status, carrier_name')
    .eq('vendor_tracking_id', vendor_tracking_id)
    .single();

  if (lookupError || !shipment) {
    // Return 200 so carrier doesn't retry on an unknown ID
    return NextResponse.json({ received: true, matched: false });
  }

  // 2. Normalize status (proxy boundary — raw never reaches client)
  const carrier = shipment.carrier_name ?? carrier_code;
  const normalized_status = normalizeCarrierStatus(status, carrier);
  const normalized_timestamp = normalizeTimestamp(timestamp);

  // 3. Insert log — raw_carrier_status stored for ops audit only
  await supabase.from('shipment_logs').insert({
    shipment_id:        shipment.id,
    status:             normalized_status,
    location:           location ?? null,
    time:               normalized_timestamp.toISOString(),
    description:        `Cập nhật tự động từ hãng vận chuyển.`,
    raw_carrier_status: status, // Hidden from client — ops audit only
  });

  // 4. Advance shipment status if this is a progression
  if (isProgression(shipment.raw_status as RawStatus, normalized_status)) {
    await supabase
      .from('shipments')
      .update({ raw_status: normalized_status })
      .eq('id', shipment.id);
  }

  return NextResponse.json({
    received: true,
    matched: true,
    shipment_id: shipment.internal_tracking_id,
    normalized_status,
  });
}
