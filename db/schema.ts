import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const vendors = sqliteTable("vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  mobile: text("mobile").notNull(),
  vendorCode: text("vendor_code").notNull().unique(),
  loginPinHash: text("login_pin_hash").notNull(),
  status: text("status", { enum: ["active", "blocked", "deleted"] }).notNull().default("active"),
  userLimit: integer("user_limit").notNull().default(1),
  extraUserRatePaise: integer("extra_user_rate_paise").notNull().default(9900),
  ipPolicyBlocked: integer("ip_policy_blocked", { mode: "boolean" }).notNull().default(false),
  ipBlockedAt: text("ip_blocked_at").notNull().default(""),
  parcelCount: integer("parcel_count").notNull().default(0),
  driveFolderId: text("drive_folder_id").notNull().default(""),
  packingFolderId: text("packing_folder_id").notNull().default(""),
  returnFolderId: text("return_folder_id").notNull().default(""),
  claimsFolderId: text("claims_folder_id").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("vendors_mobile_unique").on(table.mobile),
]);

export const deletedVendors = sqliteTable("deleted_vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id).unique(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  mobile: text("mobile").notNull().unique(),
  vendorCode: text("vendor_code").notNull(),
  parcelCount: integer("parcel_count").notNull().default(0),
  originalCreatedAt: text("original_created_at").notNull(),
  deletedAt: text("deleted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvalStatus: text("approval_status", { enum: ["none", "pending", "approved", "rejected"] }).notNull().default("none"),
  requestedBusinessName: text("requested_business_name").notNull().default(""),
  requestedContactName: text("requested_contact_name").notNull().default(""),
  requestedVendorCode: text("requested_vendor_code").notNull().default(""),
  requestedPinHash: text("requested_pin_hash").notNull().default(""),
  approvalRequestedAt: text("approval_requested_at").notNull().default(""),
  approvedAt: text("approved_at").notNull().default(""),
  sheetSynced: integer("sheet_synced", { mode: "boolean" }).notNull().default(false),
});

export const pinResetRequests = sqliteTable("pin_reset_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "resolved"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const vendorSessions = sqliteTable("vendor_sessions", {
  token: text("token").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  deviceToken: text("device_token").notNull().default(""),
  ipHash: text("ip_hash").notNull().default(""),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const vendorDevices = sqliteTable("vendor_devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  deviceToken: text("device_token").notNull(),
  ipHash: text("ip_hash").notNull(),
  maskedIp: text("masked_ip").notNull().default(""),
  ipChangeCount: integer("ip_change_count").notNull().default(0),
  status: text("status", { enum: ["active", "blocked"] }).notNull().default("active"),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("vendor_devices_vendor_device_unique").on(table.vendorId, table.deviceToken),
]);

export const marketplaceOrders = sqliteTable("marketplace_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  marketplace: text("marketplace").notNull().default("Meesho"),
  orderId: text("order_id").notNull().default(""),
  trackingId: text("tracking_id").notNull(),
  trackingKey: text("tracking_key").notNull(),
  deliveryPartner: text("delivery_partner").notNull().default("Pending"),
  bagId: text("bag_id").notNull().default(""),
  customerName: text("customer_name").notNull().default(""),
  customerAddress: text("customer_address").notNull().default(""),
  customerPincode: text("customer_pincode").notNull().default(""),
  labelUrl: text("label_url").notNull().default(""),
  paymentMode: text("payment_mode").notNull().default(""),
  orderAmountPaise: integer("order_amount_paise").notNull().default(0),
  marketplaceStatus: text("marketplace_status").notNull().default(""),
  orderDate: text("order_date").notNull(),
  packingStatus: text("packing_status", { enum: ["pending", "packed"] }).notNull().default("pending"),
  packedAt: text("packed_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("marketplace_orders_vendor_tracking_unique").on(table.vendorId, table.trackingKey),
]);

export const settlementRecords = sqliteTable("settlement_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  marketplace: text("marketplace").notNull().default("Meesho"),
  orderRef: text("order_ref").notNull(),
  trackingId: text("tracking_id").notNull().default(""),
  grossAmountPaise: integer("gross_amount_paise").notNull().default(0),
  deductionsPaise: integer("deductions_paise").notNull().default(0),
  netPaidPaise: integer("net_paid_paise").notNull().default(0),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "partial", "held", "returned"] }).notNull().default("pending"),
  paymentDate: text("payment_date").notNull().default(""),
  utr: text("utr").notNull().default(""),
  sourceFile: text("source_file").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("settlement_records_vendor_marketplace_order_unique").on(table.vendorId, table.marketplace, table.orderRef),
]);

export const parcels = sqliteTable("parcels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  trackingId: text("tracking_id").notNull().unique(),
  bagId: text("bag_id").notNull().unique(),
  uploadStatus: text("upload_status", { enum: ["pending", "uploaded", "failed"] }).notNull().default("pending"),
  videoUrl: text("video_url").notNull().default(""),
  customerName: text("customer_name").notNull().default(""),
  customerMobile: text("customer_mobile").notNull().default(""),
  pincode: text("pincode").notNull().default(""),
  deliveryPartner: text("delivery_partner").notNull().default("Pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customerVideoViews = sqliteTable("customer_video_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parcelId: integer("parcel_id").notNull().references(() => parcels.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  customerMobile: text("customer_mobile").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const returnProofs = sqliteTable("return_proofs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  trackingId: text("tracking_id").notNull(),
  returnType: text("return_type", { enum: ["return", "rto"] }).notNull(),
  uploadStatus: text("upload_status", { enum: ["pending", "uploaded", "failed"] }).notNull().default("pending"),
  videoUrl: text("video_url").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const returnClaims = sqliteTable("return_claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnProofId: integer("return_proof_id").notNull().references(() => returnProofs.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  trackingId: text("tracking_id").notNull(),
  portal: text("portal").notNull().default("Meesho"),
  issueType: text("issue_type").notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["raised", "submitted", "resolved"] }).notNull().default("raised"),
  savedAmount: integer("saved_amount").notNull().default(0),
  claimVideoUrl: text("claim_video_url").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const followUps = sqliteTable("follow_ups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claimId: integer("claim_id").notNull().references(() => returnClaims.id, { onDelete: "cascade" }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  trackingId: text("tracking_id").notNull(),
  personName: text("person_name").notNull(),
  contactNumber: text("contact_number").notNull(),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "contacted", "closed"] }).notNull().default("open"),
  sheetSynced: integer("sheet_synced", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const buyerLeads = sqliteTable("buyer_leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadCode: text("lead_code").notNull().unique(),
  contactName: text("contact_name").notNull(),
  mobile: text("mobile").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email").notNull().default(""),
  businessName: text("business_name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  marketplace: text("marketplace").notNull(),
  monthlyOrders: integer("monthly_orders").notNull().default(0),
  planName: text("plan_name", { enum: ["Trial", "Nano", "Starter", "Growth"] }).notNull(),
  retentionDays: integer("retention_days").notNull().default(30),
  preferredContactTime: text("preferred_contact_time").notNull().default("Any time"),
  note: text("note").notNull().default(""),
  purchaseStage: text("purchase_stage").notNull().default("Day 1 Purchase"),
  followUpStatus: text("follow_up_status", { enum: ["new", "connect", "not_connect"] }).notNull().default("new"),
  customerDecision: text("customer_decision", { enum: ["pending", "yes", "no"] }).notNull().default("pending"),
  nextFollowUpAt: text("next_follow_up_at").notNull().default(""),
  masterNote: text("master_note").notNull().default(""),
  lastContactedAt: text("last_contacted_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reportRequests = sqliteTable("report_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  reportType: text("report_type", { enum: ["orders", "returns", "claims", "custom"] }).notNull(),
  dateFrom: text("date_from").notNull(),
  dateTo: text("date_to").notNull(),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["requested", "preparing", "ready", "sent", "rejected"] }).notNull().default("requested"),
  masterNote: text("master_note").notNull().default(""),
  reportUrl: text("report_url").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const coupons = sqliteTable("coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  mobile: text("mobile").notNull(),
  discountPercent: integer("discount_percent").notNull(),
  startAt: text("start_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  status: text("status", { enum: ["active", "paused", "reserved", "used"] }).notNull().default("active"),
  reservedUntil: text("reserved_until").notNull().default(""),
  reservedOrderRef: text("reserved_order_ref").notNull().default(""),
  usedAt: text("used_at").notNull().default(""),
  createdBy: text("created_by").notNull().default("master-admin"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("coupons_mobile_code_unique").on(table.mobile, table.code),
]);

export const deletedCoupons = sqliteTable("deleted_coupons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  couponId: integer("coupon_id").notNull(),
  code: text("code").notNull(),
  mobile: text("mobile").notNull(),
  discountPercent: integer("discount_percent").notNull(),
  startAt: text("start_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  finalStatus: text("final_status").notNull(),
  reservedUntil: text("reserved_until").notNull().default(""),
  usedAt: text("used_at").notNull().default(""),
  originalCreatedAt: text("original_created_at").notNull(),
  createdBy: text("created_by").notNull().default("master-admin"),
  deletedAt: text("deleted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedBy: text("deleted_by").notNull().default("master-admin"),
  deleteReason: text("delete_reason").notNull().default("Deleted from Master Panel"),
  sheetSynced: integer("sheet_synced", { mode: "boolean" }).notNull().default(false),
});

export const paymentOrders = sqliteTable("payment_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  planName: text("plan_name", { enum: ["Trial", "Nano", "Starter", "Growth"] }).notNull(),
  monthlyVideoCredits: integer("monthly_video_credits").notNull(),
  userLimit: integer("user_limit").notNull().default(1),
  extraUserRatePaise: integer("extra_user_rate_paise").notNull().default(9900),
  retentionDays: integer("retention_days").notNull().default(30),
  baseAmountPaise: integer("base_amount_paise").notNull(),
  gstAmountPaise: integer("gst_amount_paise").notNull(),
  totalAmountPaise: integer("total_amount_paise").notNull(),
  originalTotalAmountPaise: integer("original_total_amount_paise").notNull().default(0),
  discountPercent: integer("discount_percent").notNull().default(0),
  discountAmountPaise: integer("discount_amount_paise").notNull().default(0),
  couponId: integer("coupon_id").references(() => coupons.id),
  couponCode: text("coupon_code").notNull().default(""),
  currency: text("currency").notNull().default("INR"),
  razorpayOrderId: text("razorpay_order_id").notNull().unique(),
  razorpayPaymentId: text("razorpay_payment_id").notNull().default(""),
  receivedAmountPaise: integer("received_amount_paise").notNull().default(0),
  providerStatus: text("provider_status").notNull().default("created"),
  reconciliationStatus: text("reconciliation_status", { enum: ["pending", "matched", "missing", "short", "excess", "manual"] }).notNull().default("pending"),
  masterNote: text("master_note").notNull().default(""),
  reconciledAt: text("reconciled_at").notNull().default(""),
  reconciledBy: text("reconciled_by").notNull().default(""),
  status: text("status", { enum: ["created", "paid", "failed"] }).notNull().default("created"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  paidAt: text("paid_at").notNull().default(""),
});

export const vendorSubscriptions = sqliteTable("vendor_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vendorId: integer("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }).unique(),
  planName: text("plan_name", { enum: ["Trial", "Nano", "Starter", "Growth"] }).notNull(),
  monthlyVideoCredits: integer("monthly_video_credits").notNull(),
  userLimit: integer("user_limit").notNull().default(1),
  extraUserRatePaise: integer("extra_user_rate_paise").notNull().default(9900),
  retentionDays: integer("retention_days").notNull().default(30),
  baseAmountPaise: integer("base_amount_paise").notNull(),
  gstAmountPaise: integer("gst_amount_paise").notNull(),
  totalAmountPaise: integer("total_amount_paise").notNull(),
  razorpayPaymentId: text("razorpay_payment_id").notNull(),
  status: text("status", { enum: ["active", "expired"] }).notNull().default("active"),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
