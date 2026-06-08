# OpenShipment — International Shipping Management System

A modern TypeScript-based shipping management system for international parcel delivery, built with Next.js, Supabase, and React. OpenShipment provides end-to-end shipment lifecycle management from price calculation to carrier tracking integration.

## 📦 Overview

OpenShipment is a comprehensive logistics platform that enables:
- **Public-facing price calculator** for international shipping rates
- **Customer checkout wizard** for booking shipments
- **Real-time tracking lookup** using internal tracking IDs (OS-XXXXXX format)
- **Admin dashboard** for warehouse operations (weight adjustment, carrier mapping)
- **Carrier webhook integration** for automatic status updates from USPS, VNPost, DHL, and FedEx

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OpenShipment System                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   Public     │     │    Admin     │     │   Carrier    │            │
│  │    Site      │     │   Dashboard  │     │   Webhooks   │            │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘            │
│         │                    │                     │                     │
│         ▼                    ▼                     ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    Next.js API Routes                         │      │
│  │  ┌──────────────────────────────────────────────────────┐    │      │
│  │  │ GET  /api/shipments/[trackingId]  - Tracking Lookup  │    │      │
│  │  │ POST /api/shipments               - Create Shipment  │    │      │
│  │  │ PATCH /api/admin/shipments/[id]/adjust-weight        │    │      │
│  │  │ PATCH /api/admin/shipments/[id]/vendor-tracking      │    │      │
│  │  │ POST /api/webhooks/carrier        - Carrier Updates  │    │      │
│  │  └──────────────────────────────────────────────────────┘    │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    Core Business Logic                        │      │
│  │  • price-engine.ts      - Pricing calculations & discounts   │      │
│  │  • tracking-normalizer.ts - Carrier status normalization    │      │
│  │  • schemas.ts           - Zod validation schemas             │      │
│  │  • types.index.ts       - TypeScript type definitions        │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                      Supabase Database                        │      │
│  │  • customers          - Customer accounts & volume tiers     │      │
│  │  • shipments          - Shipment records & pricing           │      │
│  │  • shipment_logs      - Tracking history & audit trail       │      │
│  │  • generate_tracking_id() - DB function for OS-XXXXXX IDs   │      │
│  │  • calculate_shipment_cost() - DB pricing function          │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. Customer Journey (Booking a Shipment)

```
User Input → useCalculator Hook → Price Engine → Display Rates
                                      ↓
User proceeds to Checkout → useCheckout Hook → Validate Address
                                      ↓
                          Submit to POST /api/shipments
                                      ↓
                          Server validates with Zod schemas
                                      ↓
                          Calculate pricing (price-engine.ts)
                                      ↓
                          Generate tracking ID (DB function)
                                      ↓
                          Insert shipment + initial log
                                      ↓
                          Return shipment with OS-XXXXXX ID
```

### 2. Tracking Lookup Flow

```
User enters OS-XXXXXX → useTracking Hook → GET /api/shipments/[id]
                                              ↓
                                      Query Supabase
                                              ↓
                                      Return shipment + logs
                                      (raw_carrier_status excluded)
                                              ↓
                                      Display timeline to user
```

### 3. Admin Operations Flow

```
Admin selects order → useAdminOrder Hook
         ↓
    ┌────────────────────┬────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
Adjust Weight      Map Carrier         View Details
    │                    │
    ▼                    ▼
PATCH /adjust-weight  PATCH /vendor-tracking
    │                    │
    ▼                    ▼
Recalculate cost     Update carrier info
Check surcharge      Set status=in_transit
Update shipment      Insert audit log
Insert audit log
```

### 4. Carrier Webhook Flow

```
Carrier (USPS/VNPost/DHL/FedEx) → POST /api/webhooks/carrier
                                      ↓
                              Verify HMAC signature
                                      ↓
                              Validate payload (Zod)
                                      ↓
                              Lookup shipment by vendor_tracking_id
                                      ↓
                              Normalize status (tracking-normalizer.ts)
                                      ↓
                              Insert shipment_log
                              (store raw_carrier_status for audit)
                                      ↓
                              Advance shipment.raw_status if progression
                                      ↓
                              Return acknowledgment
```

## 📁 Project Structure

```
/workspace
├── types.index.ts           # Core TypeScript interfaces & types
├── schemas.ts               # Zod validation schemas for all forms/APIs
├── price-engine.ts          # Pricing logic, discounts, compliance rules
├── tracking-normalizer.ts   # Carrier status normalization logic
├── supabase.ts              # Supabase client factory (browser/server/admin)
│
├── useCalculator.ts         # React hook for price calculator UI
├── useCheckout.ts           # React hook for 3-step checkout wizard
├── useTracking.ts           # React hook for public tracking lookup
├── useAdminOrder.ts         # React hook for admin order management
├── useNotification.ts       # React hook for toast notifications
│
├── shipments.route.ts       # POST /api/shipments
├── shipments.trackingId.route.ts  # GET /api/shipments/[trackingId]
├── admin.adjust-weight.route.ts   # PATCH /api/admin/shipments/[id]/adjust-weight
├── admin.vendor-tracking.route.ts # PATCH /api/admin/shipments/[id]/vendor-tracking
└── webhooks.carrier.route.ts      # POST /api/webhooks/carrier
```

## 🔧 Dependencies

### Required npm Packages

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "@supabase/supabase-js": "^2.x",
    "@supabase/ssr": "^0.x",
    "zod": "^3.x"
  }
}
```

### Environment Variables

Create a `.env.local` file with:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Webhook Security
CARRIER_WEBHOOK_SECRET=your_hmac_secret_for_carrier_webhooks
```

## 🗄️ Database Schema

### Tables

#### `customers`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Customer name |
| email | text | Contact email |
| phone | text | Contact phone |
| tier | enum | VolumeTier (Silver/Gold/Platinum) |
| monthly_volume | numeric | Monthly shipping volume |
| created_at | timestamptz | Record creation time |
| updated_at | timestamptz | Last update time |

#### `shipments`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| internal_tracking_id | text | OS-XXXXXX format |
| customer_id | uuid | FK to customers |
| customer_name | text | Sender name |
| sender_phone | text | Sender phone (VN format) |
| sender_address | text | Pickup address |
| receiver_name | text | Recipient name |
| receiver_phone | text | Recipient phone |
| receiver_address | text | Delivery address (international format) |
| destination_country | enum | USA/Australia/Germany/Japan/Singapore |
| commodity_type | enum | General/Food/Cosmetics/Electronics |
| commodity_detail | text | Detailed description |
| declared_value | numeric | USD value for insurance |
| declared_weight | numeric | Customer-declared weight (kg) |
| actual_weight | numeric | Measured weight (kg) |
| length, width, height | numeric | Dimensions (cm) |
| volumetric_weight | numeric | Calculated volumetric weight |
| chargeable_weight | numeric | Max(actual, volumetric) |
| final_cost | numeric | Final price in VND |
| surcharge_amount | numeric | Additional charges if any |
| raw_status | enum | pending/arrived_at_hub/awaiting_surcharge/in_transit/delivered/returned/exception |
| carrier_name | enum | USPS_Injection/VNPost_Priority/DHL_Express/FedEx_International |
| vendor_tracking_id | text | External carrier tracking number |
| created_at | timestamptz | Booking time |
| updated_at | timestamptz | Last update |

#### `shipment_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| shipment_id | uuid | FK to shipments |
| status | text | Human-readable status |
| location | text | Event location |
| time | timestamptz | Event timestamp |
| description | text | Detailed description |
| raw_carrier_status | text | Original carrier status (audit only, never exposed to client) |
| created_at | timestamptz | Log entry time |

### Database Functions

#### `generate_tracking_id()`
Returns a unique 6-character alphanumeric ID prefixed with "OS-" (e.g., OS-882194).

#### `calculate_shipment_cost(p_destination, p_actual_weight, p_length, p_width, p_height)`
Returns volumetric_weight, chargeable_weight, final_cost, divisor_used, and discount_label.

## 💰 Pricing Engine

### Destination Rules

| Destination | Divisor | Rate/kg (VND) | DHL Retail | FedEx Retail |
|-------------|---------|---------------|------------|--------------|
| USA | 6000 | 220,000 | 380,000 | 360,000 |
| Australia | 6000 | 240,000 | 410,000 | 390,000 |
| Germany | 6000 | 260,000 | 440,000 | 420,000 |
| Japan | 7000 | 160,000 | 290,000 | 270,000 |
| Singapore | 7000 | 120,000 | 210,000 | 195,000 |

### Volume Discounts

| Tier | Weight Range | Discount | Label |
|------|--------------|----------|-------|
| Silver | 5–20 kg | 5% | Hội viên Bạc |
| Gold | 20–100 kg | 10% | Hội viên Vàng |
| Platinum | >100 kg | 15% | Hội viên Kim Cương |

### Volumetric Weight Formula

```
volumetric_weight = (length × width × height) / divisor
chargeable_weight = max(actual_weight, volumetric_weight)
final_cost = chargeable_weight × rate_per_kg × tier_multiplier
```

**Note:** DHL/FedEx competitor rates use standard divisor of 5000 for comparison display.

## 🚚 Carrier Status Normalization

The system normalizes raw carrier statuses into 7 internal states:

| Internal Status | Description | Color |
|-----------------|-------------|-------|
| `pending` | Chờ gom hàng | Amber |
| `arrived_at_hub` | Đã nhập kho | Amber |
| `awaiting_surcharge` | Lệch thể tích | Rose |
| `in_transit` | Đang đi liên bưu | Blue |
| `delivered` | Đã giao hàng | Emerald |
| `returned` | Trả về người gửi | Slate |
| `exception` | Ngoại lệ / Giữ lại | Red |

### Supported Carriers

- **USPS_Injection**: Maps USPS API statuses (pre_shipment, accepted, in_transit, delivered, etc.)
- **VNPost_Priority**: Maps Vietnamese statuses (tiep_nhan, xuat_phat, da_giao, etc.)
- **DHL_Express**: Maps DHL event codes (PL, PU, DF, OK, etc.)
- **FedEx_International**: Uses TrackingMore generic mapping

## 🔐 Security Considerations

1. **Service Role Key**: Only used in admin routes (`admin.*.route.ts`). Never expose to browser.
2. **Webhook Signature**: HMAC-SHA256 verification via `CARRIER_WEBHOOK_SECRET`.
3. **Raw Carrier Status**: Stored in DB for audit but intentionally excluded from client responses.
4. **Server-Side Pricing**: All cost calculations happen server-side; client values are for display only.
5. **Zod Validation**: All API inputs validated with strict schemas before processing.

## 🛠️ API Reference

### Public APIs

#### `POST /api/shipments`
Create a new shipment booking.

**Request Body:**
```typescript
{
  sender_name: string;
  sender_phone: string;  // VN format: 0xxxxxxxxx or +84xxxxxxxxx
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;  // International format
  destination_country: 'USA' | 'Australia' | 'Germany' | 'Japan' | 'Singapore';
  commodity_type: 'General' | 'Food' | 'Cosmetics' | 'Electronics';
  commodity_detail: string;  // 5-200 chars
  declared_value: number;  // USD, max 2000
  declared_weight: number;  // kg, max 70
  actual_weight: number;
  length: number;  // cm, max 300
  width: number;
  height: number;
}
```

**Response:** `201 Created`
```json
{
  "shipment": { /* Shipment object with internal_tracking_id */ }
}
```

---

#### `GET /api/shipments/:trackingId`
Lookup shipment by internal tracking ID (OS-XXXXXX).

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "internal_tracking_id": "OS-882194",
  "raw_status": "in_transit",
  "carrier_name": "USPS_Injection",
  "logs": [
    {
      "status": "Đã giao bưu tá liên tuyến không lưu",
      "location": "Kho bưu phẩm quốc tế Nội Bài",
      "time": "2026-06-05T09:30:00Z",
      "description": "..."
    }
  ]
}
```

---

### Admin APIs (Require Authentication)

#### `PATCH /api/admin/shipments/:id/adjust-weight`
Update physical measurements and recalculate cost.

**Request Body:**
```typescript
{
  actual_weight: number;
  length: number;
  width: number;
  height: number;
}
```

**Response:** `200 OK`
```json
{
  "shipment": { /* Updated shipment */ },
  "recalculation": {
    "volumetric_weight": 2.5,
    "chargeable_weight": 3.0,
    "new_cost": 660000,
    "delta": 55000,
    "surcharge_triggered": true
  }
}
```

---

#### `PATCH /api/admin/shipments/:id/vendor-tracking`
Map external carrier tracking ID to shipment.

**Request Body:**
```typescript
{
  carrier_name: 'USPS_Injection' | 'VNPost_Priority' | 'DHL_Express' | 'FedEx_International';
  vendor_tracking_id: string;
}
```

**Response:** `200 OK`
```json
{
  "shipment": { /* Updated shipment with vendor_tracking_id */ }
}
```

---

### Webhook Endpoint

#### `POST /api/webhooks/carrier`
Receive tracking updates from carriers (TrackingMore/EasyPost).

**Headers:**
- `x-trackingmore-signature` or `x-easypost-hmac-sha256`: HMAC signature

**Request Body:**
```typescript
{
  vendor_tracking_id: string;
  carrier_code: string;
  status: string;  // Raw carrier status
  location?: string | null;
  timestamp: string;
}
```

**Response:** `200 OK`
```json
{
  "received": true,
  "matched": true,
  "shipment_id": "OS-882194",
  "normalized_status": "in_transit"
}
```

## 🎯 Key Features

### 1. Multi-Carrier Support
Seamlessly integrates with USPS, VNPost, DHL Express, and FedEx through a unified status normalization layer.

### 2. Intelligent Pricing
- Volumetric weight calculation with destination-specific divisors
- Automatic tier discounts based on shipment weight
- Real-time surcharge detection when actual dimensions exceed declared

### 3. Compliance & Audit
- Raw carrier statuses stored for operational audit
- Complete shipment lifecycle logging
- Address validation for international formats

### 4. Admin Workflow
- Warehouse staff can adjust measurements post-receipt
- Automatic flagging of volume discrepancies (>50,000 VND triggers surcharge)
- One-click carrier mapping for international handoff

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Supabase account and project
- Next.js 14+ project setup

### Installation

1. **Install dependencies:**
```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

2. **Configure environment variables:**
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

3. **Set up Supabase database:**
   - Run SQL migrations to create tables (`customers`, `shipments`, `shipment_logs`)
   - Create database functions (`generate_tracking_id`, `calculate_shipment_cost`)
   - Configure Row Level Security (RLS) policies

4. **Import library modules:**
```typescript
import { createBrowserSupabase, createServerSupabase, createAdminSupabase } from '@/lib/supabase';
import { buildEstimatedRates, calcFinalCost } from '@/lib/price-engine';
import { normalizeCarrierStatus } from '@/lib/tracking-normalizer';
```

5. **Use React hooks in components:**
```typescript
import { useCalculator } from '@/lib/useCalculator';
import { useCheckout } from '@/lib/useCheckout';
import { useTracking } from '@/lib/useTracking';
import { useAdminOrder } from '@/lib/useAdminOrder';
import { useNotification } from '@/lib/useNotification';
```

## 📝 License

This project is proprietary software developed for OpenShipment logistics operations.

## 🤝 Contributing

Internal development only. Contact the core team for feature requests or bug reports.

---

**Built with ❤️ for international e-commerce logistics**
