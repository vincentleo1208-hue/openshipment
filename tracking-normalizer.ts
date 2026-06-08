// =============================================================
// OpenShipment — Carrier Status Normalizer
// Absorbs raw TrackingMore/USPS/VNPost webhook payloads
// Translates to internal RawStatus — never exposes raw to client
// =============================================================
import type { RawStatus } from '@/types';

type StatusMap = Record<string, RawStatus>;

const USPS_MAP: StatusMap = {
  pre_shipment:                'pending',
  accepted:                    'arrived_at_hub',
  arrived_usps_facility:       'arrived_at_hub',
  departed_usps_facility:      'in_transit',
  in_transit_to_destination:   'in_transit',
  out_for_delivery:            'in_transit',
  delivered:                   'delivered',
  delivery_exception:          'exception',
  return_to_sender:            'returned',
};

const VNPOST_MAP: StatusMap = {
  tiep_nhan:  'arrived_at_hub',
  xuat_phat:  'in_transit',
  van_chuyen: 'in_transit',
  thong_quan: 'in_transit',
  phat_hang:  'in_transit',
  da_giao:    'delivered',
  tra_lai:    'returned',
  kiem_tra:   'arrived_at_hub',
};

const DHL_MAP: StatusMap = {
  PL: 'arrived_at_hub',
  PU: 'arrived_at_hub',
  DF: 'in_transit',
  AF: 'arrived_at_hub',
  CC: 'in_transit',
  WC: 'in_transit',
  OK: 'delivered',
  RD: 'returned',
  transit: 'in_transit',
  delivered: 'delivered',
  failure: 'exception',
};

const TRACKINGMORE_MAP: StatusMap = {
  notfound:    'in_transit',
  transit:     'in_transit',
  pickup:      'arrived_at_hub',
  delivered:   'delivered',
  undelivered: 'exception',
  exception:   'exception',
  expired:     'exception',
  pending:     'pending',
};

const CARRIER_MAPS: Record<string, StatusMap> = {
  USPS_Injection:   USPS_MAP,
  VNPost_Priority:  VNPOST_MAP,
  DHL_Express:      DHL_MAP,
  FedEx_International: TRACKINGMORE_MAP,
};

export function normalizeCarrierStatus(
  rawStatus: string,
  carrierCode: string,
): RawStatus {
  const map = CARRIER_MAPS[carrierCode] ?? TRACKINGMORE_MAP;
  const key = rawStatus.toLowerCase().replace(/[\s-]/g, '_');

  if (key in map) return map[key];

  // Partial match
  for (const [pattern, status] of Object.entries(map)) {
    if (key.includes(pattern) || pattern.includes(key)) return status;
  }

  // Semantic fallback
  if (/deliver/i.test(rawStatus)) return 'delivered';
  if (/transit|flight|airborne|departing/i.test(rawStatus)) return 'in_transit';
  if (/customs?|clearance/i.test(rawStatus)) return 'in_transit';
  if (/pickup|received|accept|arrival/i.test(rawStatus)) return 'arrived_at_hub';
  if (/return|rts|undeliver/i.test(rawStatus)) return 'returned';
  if (/hold|exception|attempt|fail/i.test(rawStatus)) return 'exception';

  return 'in_transit'; // safe default
}

export function normalizeTimestamp(raw: string): Date {
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;

  // USPS: "2026-06-05 09:30:00" (no timezone)
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})$/);
  if (match) return new Date(`${match[1]}T${match[2]}Z`);

  return new Date();
}

// Status progression order — used to decide when to update shipment.raw_status
export const STATUS_ORDER: Record<RawStatus, number> = {
  pending:            0,
  arrived_at_hub:     1,
  awaiting_surcharge: 2,
  in_transit:         3,
  delivered:          4,
  exception:          -1,
  returned:           -1,
};

export function isProgression(current: RawStatus, next: RawStatus): boolean {
  if (next === 'exception' || next === 'returned') return true;
  return STATUS_ORDER[next] > STATUS_ORDER[current];
}
