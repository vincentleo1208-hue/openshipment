// =============================================================
// OpenShipment — Core TypeScript Types
// Derived from openshipment_operating_system.tsx prototype
// =============================================================

// ─── Enums ────────────────────────────────────────────────────

export type VolumeTier = 'Silver' | 'Gold' | 'Platinum';

export type RawStatus =
  | 'pending'
  | 'arrived_at_hub'
  | 'awaiting_surcharge'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'exception';

export type CarrierName =
  | 'USPS_Injection'
  | 'VNPost_Priority'
  | 'DHL_Express'
  | 'FedEx_International';

export type CommodityType =
  | 'General'
  | 'Food'
  | 'Cosmetics'
  | 'Electronics';

export type DestinationKey = 'USA' | 'Australia' | 'Germany' | 'Japan' | 'Singapore';

// ─── Database Row Types ────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: VolumeTier;
  monthly_volume: number;
  created_at: string;
  updated_at: string;
}

export interface ShipmentLog {
  id: string;
  shipment_id: string;
  status: string;
  location: string | null;
  time: string;
  description: string;
  raw_carrier_status: string | null; // Never exposed to client
  created_at: string;
}

export interface Shipment {
  id: string;
  internal_tracking_id: string; // OS-XXXXXX
  customer_id: string;
  customer_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  destination_country: DestinationKey;
  commodity_type: CommodityType;
  commodity_detail: string;
  declared_value: number; // USD
  // Weights (kg)
  length: number; // cm
  width: number;  // cm
  height: number; // cm
  declared_weight: number;
  actual_weight: number;
  volumetric_weight: number;
  chargeable_weight: number;
  // Pricing (VND)
  final_cost: number;
  surcharge_amount: number;
  // Status
  raw_status: RawStatus;
  carrier_name: CarrierName;
  vendor_tracking_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Joined
  logs?: ShipmentLog[];
}

// ─── Price Engine Types ────────────────────────────────────────

export interface DestinationRule {
  name: string;
  divisor: number;
  rate_per_kg: number;       // VND — OpenShipment economy rate
  dhl_retail_per_kg: number; // VND
  fedex_retail_per_kg: number; // VND
  local_tip: string;
}

export interface CalculatorParams {
  destination: DestinationKey;
  weight: number;
  length: number;
  width: number;
  height: number;
  commodity: CommodityType;
}

export interface EstimatedRates {
  volumetric_weight: number;
  chargeable_weight: number;
  system_cost: number;
  dhl_cost: number;
  fedex_cost: number;
  discount_applied: string;
  divisor_used: number;
  local_tip: string;
}

// ─── Form / API Input Types ────────────────────────────────────

export interface CheckoutStep1Input {
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  is_address_validated: boolean;
}

export interface CheckoutStep2Input {
  commodity_detail: string;
  declared_value: number;
}

export interface CreateShipmentPayload {
  customer_id?: string;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  destination_country: DestinationKey;
  commodity_type: CommodityType;
  commodity_detail: string;
  declared_value: number;
  declared_weight: number;
  actual_weight: number;
  length: number;
  width: number;
  height: number;
}

export interface WeightAdjustPayload {
  actual_weight: number;
  length: number;
  width: number;
  height: number;
}

export interface VendorTrackingPayload {
  carrier_name: CarrierName;
  vendor_tracking_id: string;
}

export interface CarrierWebhookPayload {
  vendor_tracking_id: string;
  carrier_code: string;
  status: string;
  location?: string | null;
  timestamp: string;
}

// ─── UI Component Prop Types ───────────────────────────────────

export type NotifyFn = (message: string, type?: 'success' | 'error' | 'warning') => void;

export interface Notification {
  message: string;
  type: 'success' | 'error' | 'warning';
}

// ─── Supabase DB Shape ─────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: Customer;
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>;
      };
      shipments: {
        Row: Shipment;
        Insert: Omit<Shipment, 'id' | 'internal_tracking_id' | 'volumetric_weight' | 'chargeable_weight' | 'final_cost' | 'created_at' | 'updated_at' | 'logs'>;
        Update: Partial<Omit<Shipment, 'id' | 'internal_tracking_id' | 'created_at' | 'logs'>>;
      };
      shipment_logs: {
        Row: ShipmentLog;
        Insert: Omit<ShipmentLog, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Functions: {
      generate_tracking_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      calculate_shipment_cost: {
        Args: {
          p_destination: DestinationKey;
          p_actual_weight: number;
          p_length: number;
          p_width: number;
          p_height: number;
        };
        Returns: {
          volumetric_weight: number;
          chargeable_weight: number;
          final_cost: number;
          divisor_used: number;
          discount_label: string;
        }[];
      };
    };
  };
}
