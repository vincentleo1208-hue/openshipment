# DHL & FedEx Integration Guide

## Overview

OpenShipment is **already designed** to integrate with DHL and FedEx through tracking aggregation services. The codebase includes:

✅ Type definitions for `DHL_Express` and `FedEx_International`  
✅ Pricing rates for both carriers in `price-engine.ts`  
✅ Status normalization maps in `tracking-normalizer.ts`  
✅ Webhook handler ready to receive updates in `webhooks.carrier.route.ts`  
✅ Admin UI hook (`useAdminOrder.ts`) for mapping carrier tracking IDs  

**What's missing:** The actual carrier registration function to push shipments to TrackingMore/EasyPost.

---

## Integration Options

### Option 1: TrackingMore (Recommended for Starters)

**Pros:**
- Supports 800+ carriers including DHL/FedEx
- Simple REST API
- Free tier: 50 credits/month
- Webhook support for real-time updates

**Cons:**
- Limited credits on free plan
- May need upgrade for production volume

**Pricing:** https://www.trackingmore.com/pricing

---

### Option 2: EasyPost (Enterprise-Grade)

**Pros:**
- Full shipping API (labels, tracking, insurance)
- Direct DHL/FedEx integration
- High reliability and SLA
- Built-in address validation

**Cons:**
- More complex setup
- Higher cost structure
- Requires business verification

**Pricing:** https://www.easypost.com/pricing

---

## Implementation Steps

### Step 1: Choose & Register with Provider

#### For TrackingMore:
1. Sign up at https://www.trackingmore.com
2. Get API key from dashboard
3. Note webhook endpoint URL they'll call

#### For EasyPost:
1. Sign up at https://www.easypost.com
2. Complete business verification
3. Get API keys (test + production)
4. Configure carrier accounts (DHL/FedEx)

---

### Step 2: Add Environment Variables

```bash
# .env.local

# TrackingMore
TRACKINGMORE_API_KEY=your_trackingmore_api_key
TRACKINGMORE_WEBHOOK_SECRET=your_webhook_secret

# OR EasyPost
EASYPOST_API_KEY=your_easypost_api_key
EASYPOST_WEBHOOK_SECRET=your_webhook_secret

# Existing
CARRIER_WEBHOOK_SECRET=your_hmac_secret
```

---

### Step 3: Create Carrier Registration Service

Create new file: `/workspace/lib/carrier-registration.ts`

```typescript
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
```

---

### Step 4: Update Admin Vendor Tracking Route

Update `/workspace/admin.vendor-tracking.route.ts`:

```typescript
// Add this import at the top
import { registerShipmentWithCarrier } from '@/lib/carrier-registration';

// Inside the POST handler, after updating the shipment:
// 5. Register with external tracking service
const registration = await registerShipmentWithCarrier(
  vendor_tracking_id,
  carrier_name,
  process.env.TRACKING_PROVIDER as any ?? 'trackingmore'
);

if (!registration.success) {
  console.warn('Failed to register with carrier:', registration.error);
  // Don't fail the request - tracking will still work via webhooks
  // But log for ops team to investigate
}

return NextResponse.json({
  shipment: updatedShipment,
  tracking_registration: registration,
});
```

---

### Step 5: Configure Webhook Endpoints

#### For TrackingMore:
1. Go to Dashboard → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/carrier`
3. Set events: `tracking_updated`, `delivered`, `exception`
4. Save secret key to `CARRIER_WEBHOOK_SECRET`

#### For EasyPost:
1. Go to Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/carrier`
3. Select events: `tracker.updated`
4. Copy HMAC secret to `CARRIER_WEBHOOK_SECRET`

---

### Step 6: Test Integration

#### Test Flow:
1. Create a test shipment via checkout
2. Admin maps DHL/FedEx tracking ID
3. System registers with TrackingMore/EasyPost
4. Wait for carrier status update (or simulate via API)
5. Verify webhook received at `/api/webhooks/carrier`
6. Check `shipment_logs` table for normalized status

#### Manual Testing Script:
```bash
# Simulate a DHL webhook
curl -X POST https://yourdomain.com/api/webhooks/carrier \
  -H "Content-Type: application/json" \
  -H "x-trackingmore-signature: your_secret" \
  -d '{
    "vendor_tracking_id": "1234567890",
    "carrier_code": "dhl",
    "status": "transit",
    "location": "Leipzig Hub",
    "timestamp": "2026-06-05T14:30:00Z"
  }'
```

---

## Carrier-Specific Notes

### DHL Express

**Supported Events:**
- `PL` - Processed at location
- `PU` - Picked up
- `DF` - Departed facility
- `AF` - Arrived at facility
- `CC` - Customs clearance
- `WC` - With courier
- `OK` - Delivered
- `RD` - Return to sender

**Requirements:**
- DHL account number for direct integration
- Or use TrackingMore aggregator (no account needed)

---

### FedEx International

**Supported Events:**
- `Pickup` - Package picked up
- `In transit` - On the way
- `Customs clearance` - International processing
- `Out for delivery` - Final delivery attempt
- `Delivered` - Successfully delivered
- `Exception` - Delivery issue

**Requirements:**
- FedEx API credentials for direct integration
- Or use TrackingMore/EasyPost aggregator

---

## Production Checklist

- [ ] Choose tracking provider (TrackingMore or EasyPost)
- [ ] Register account and get API keys
- [ ] Add environment variables to `.env.local` and production
- [ ] Create `carrier-registration.ts` service
- [ ] Update `admin.vendor-tracking.route.ts`
- [ ] Configure webhook URLs with provider
- [ ] Test with real DHL/FedEx tracking numbers
- [ ] Monitor webhook logs for errors
- [ ] Set up alerts for failed registrations
- [ ] Document ops procedures for manual fallback

---

## Troubleshooting

### Issue: Webhooks not received
**Solution:** Check provider dashboard for delivery logs. Ensure firewall allows inbound connections from provider IPs.

### Issue: Status not normalizing correctly
**Solution:** Add new status mappings to `tracking-normalizer.ts` DHL_MAP or TRACKINGMORE_MAP.

### Issue: API rate limits
**Solution:** Upgrade TrackingMore plan or implement request queuing.

### Issue: Duplicate tracking entries
**Solution:** Check `vendor_tracking_id` uniqueness constraint in database.

---

## Cost Estimation

### TrackingMore
- Free: 50 credits/month (~50 shipments)
- Starter: $29/month (500 credits)
- Professional: $79/month (2000 credits)
- Enterprise: Custom pricing

### EasyPost
- Free tier available for testing
- Pay-as-you-go: $0.05 per tracker + carrier fees
- Volume discounts available

**Recommendation:** Start with TrackingMore free tier for testing, upgrade based on volume.

---

## Next Steps

1. **Immediate:** Create `carrier-registration.ts` file
2. **Short-term:** Test with TrackingMore sandbox
3. **Medium-term:** Evaluate EasyPost for full shipping API
4. **Long-term:** Consider direct carrier API integration for high volume

For questions or issues, check provider documentation:
- TrackingMore: https://www.trackingmore.com/api-docs.html
- EasyPost: https://www.easypost.com/docs
