// =============================================================
// OpenShipment — Zod Runtime Validation Schemas
// One schema per form / API surface in the prototype
// =============================================================
import { z } from 'zod';

// ─── Shared ───────────────────────────────────────────────────

export const DestinationKeySchema = z.enum([
  'USA', 'Australia', 'Germany', 'Japan', 'Singapore',
]);

export const CommodityTypeSchema = z.enum([
  'General', 'Food', 'Cosmetics', 'Electronics',
]);

export const CarrierNameSchema = z.enum([
  'USPS_Injection', 'VNPost_Priority', 'DHL_Express', 'FedEx_International',
]);

// ─── Module 1: Price Calculator ───────────────────────────────

export const CalculatorParamsSchema = z.object({
  destination: DestinationKeySchema,
  weight: z
    .number({ invalid_type_error: 'Vui lòng nhập số hợp lệ' })
    .positive('Cân nặng phải lớn hơn 0')
    .max(70, 'Cân nặng tối đa 70kg'),
  length: z.number().positive().max(300),
  width:  z.number().positive().max(300),
  height: z.number().positive().max(300),
  commodity: CommodityTypeSchema,
});

export type CalculatorParamsInput = z.infer<typeof CalculatorParamsSchema>;

// ─── Module 2: Tracking Lookup ────────────────────────────────

export const TrackingLookupSchema = z.object({
  tracking_id: z
    .string()
    .min(1, 'Vui lòng nhập mã vận đơn')
    .regex(/^OS-[A-Z0-9]{6}$/, 'Định dạng không hợp lệ. Ví dụ: OS-882194'),
});

export type TrackingLookupInput = z.infer<typeof TrackingLookupSchema>;

// ─── Module 3: Checkout Wizard ────────────────────────────────

export const CheckoutStep1Schema = z.object({
  sender_name: z.string().min(2, 'Tên người gửi tối thiểu 2 ký tự'),
  sender_phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại Việt Nam không hợp lệ'),
  sender_address: z.string().min(10, 'Địa chỉ người gửi quá ngắn'),
  receiver_name: z.string().min(2, 'Tên người nhận tối thiểu 2 ký tự'),
  receiver_phone: z.string().min(7, 'Số điện thoại người nhận không hợp lệ'),
  receiver_address: z
    .string()
    .min(15, 'Vui lòng dùng tính năng chuẩn hóa địa chỉ tự động'),
  is_address_validated: z.boolean(),
});

export type CheckoutStep1Input = z.infer<typeof CheckoutStep1Schema>;

export const CheckoutStep2Schema = z.object({
  commodity_detail: z
    .string()
    .min(5, 'Mô tả hàng hóa cần ít nhất 5 ký tự')
    .max(200, 'Mô tả không được vượt quá 200 ký tự'),
  declared_value: z
    .number()
    .positive('Giá trị khai báo phải lớn hơn 0')
    .max(2000, 'Giá trị khai báo tối đa 2000 USD'),
});

export type CheckoutStep2Input = z.infer<typeof CheckoutStep2Schema>;

export const CreateShipmentSchema = z.object({
  customer_id: z.string().uuid().optional(),
  sender_name: z.string().min(2),
  sender_phone: z.string().min(7),
  sender_address: z.string().min(10),
  receiver_name: z.string().min(2),
  receiver_phone: z.string().min(7),
  receiver_address: z.string().min(15),
  destination_country: DestinationKeySchema,
  commodity_type: CommodityTypeSchema,
  commodity_detail: z.string().min(5).max(200),
  declared_value: z.number().positive().max(2000),
  declared_weight: z.number().positive().max(70),
  actual_weight: z.number().positive().max(70),
  length: z.number().positive().max(300),
  width:  z.number().positive().max(300),
  height: z.number().positive().max(300),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;

// ─── Module 4: Admin Operations ───────────────────────────────

export const WeightAdjustSchema = z.object({
  actual_weight: z
    .number({ invalid_type_error: 'Sai định dạng, vui lòng nhập số' })
    .positive('Cân nặng phải lớn hơn 0')
    .max(70),
  length: z.number().positive().max(300),
  width:  z.number().positive().max(300),
  height: z.number().positive().max(300),
});

export type WeightAdjustInput = z.infer<typeof WeightAdjustSchema>;

export const VendorTrackingSchema = z.object({
  carrier_name: CarrierNameSchema,
  vendor_tracking_id: z
    .string()
    .min(5, 'Mã vận đơn liên bưu không được để trống')
    .max(100)
    .transform((v) => v.toUpperCase().trim()),
});

export type VendorTrackingInput = z.infer<typeof VendorTrackingSchema>;

// ─── Carrier Webhook (POST /api/webhooks/carrier) ─────────────

export const CarrierWebhookSchema = z.object({
  vendor_tracking_id: z.string().min(1),
  carrier_code: z.string().min(1),
  status: z.string().min(1),
  location: z.string().nullable().optional(),
  timestamp: z.string(),
  raw_payload: z.record(z.unknown()).optional(),
});

export type CarrierWebhookInput = z.infer<typeof CarrierWebhookSchema>;
