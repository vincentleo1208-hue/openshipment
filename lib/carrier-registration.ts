// =============================================================
// OpenShipment — Carrier Registration Service
// Registers shipments with TrackingMore or EasyPost for tracking
// =============================================================

import type { CarrierName } from '@/types';

const TRACKINGMORE_API_KEY = process.env.TRACKINGMORE_API_KEY ?? '';
const EASYPOST_API_KEY = process.env.EASYPOST_API_KEY ?? '';

interface CarrierRegistrationResult {
  success: boolean;
  vendor_tracking_id?: string;
  error?: string;
}

/**
 * Map internal carrier names to TrackingMore carrier codes
 * https://www.trackingmore.com/api/carriers.html
 */
const TRACKINGMORE_CARRIER_CODES: Record<CarrierName, string> = {
  USPS_Injection: 'usps',
  VNPost_Priority: 'vnpost',
  DHL_Express: 'dhl',
  FedEx_International: 'fedex',
};

/**
 * Register shipment with TrackingMore
 * @param trackingNumber - Carrier-provided tracking number
 * @param carrierName - Internal carrier name
 */
export async function registerWithTrackingMore(
  trackingNumber: string,
  carrierName: CarrierName,
): Promise<CarrierRegistrationResult> {
  if (!TRACKINGMORE_API_KEY) {
    return {
      success: false,
      error: 'TRACKINGMORE_API_KEY not configured',
    };
  }

  const carrierCode = TRACKINGMORE_CARRIER_CODES[carrierName];

  try {
    const response = await fetch('https://api.trackingmore.com/v4/trackings/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tracking-Api-Key': TRACKINGMORE_API_KEY,
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        carrier_code: carrierCode,
        // Optional: add customer info for better UX
        // customer_name: shipment.customer_name,
        // destination_country: shipment.destination_country,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.meta?.message ?? 'Failed to register with TrackingMore',
      };
    }

    return {
      success: true,
      vendor_tracking_id: data.data?.tracking_number ?? trackingNumber,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register shipment with EasyPost
 * @param trackingNumber - Carrier-provided tracking number
 * @param carrierName - Internal carrier name
 */
export async function registerWithEasyPost(
  trackingNumber: string,
  carrierName: CarrierName,
): Promise<CarrierRegistrationResult> {
  if (!EASYPOST_API_KEY) {
    return {
      success: false,
      error: 'EASYPOST_API_KEY not configured',
    };
  }

  // EasyPost carrier mapping
  const CARRIER_MAPPING: Record<CarrierName, string> = {
    USPS_Injection: 'USPS',
    VNPost_Priority: 'VNPost',
    DHL_Express: 'DHL',
    FedEx_International: 'FedEx',
  };

  const carrierString = CARRIER_MAPPING[carrierName];

  try {
    const response = await fetch('https://api.easypost.com/v2/trackers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EASYPOST_API_KEY}`,
      },
      body: JSON.stringify({
        tracking_code: trackingNumber,
        carrier: carrierString,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message ?? 'Failed to register with EasyPost',
      };
    }

    return {
      success: true,
      vendor_tracking_id: data.tracking_code ?? trackingNumber,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Unified registration function - chooses provider based on env vars
 */
export async function registerShipmentWithCarrier(
  trackingNumber: string,
  carrierName: CarrierName,
  preferredProvider: 'trackingmore' | 'easypost' = 'trackingmore',
): Promise<CarrierRegistrationResult> {
  if (preferredProvider === 'easypost') {
    return registerWithEasyPost(trackingNumber, carrierName);
  }
  return registerWithTrackingMore(trackingNumber, carrierName);
}
