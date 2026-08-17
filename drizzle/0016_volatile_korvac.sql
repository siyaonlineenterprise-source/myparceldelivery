CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`mobile` text NOT NULL,
	`discount_percent` integer NOT NULL,
	`start_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`reserved_until` text DEFAULT '' NOT NULL,
	`reserved_order_ref` text DEFAULT '' NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT 'master-admin' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_mobile_code_unique` ON `coupons` (`mobile`,`code`);--> statement-breakpoint
CREATE TABLE `deleted_coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` integer NOT NULL,
	`code` text NOT NULL,
	`mobile` text NOT NULL,
	`discount_percent` integer NOT NULL,
	`start_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`final_status` text NOT NULL,
	`reserved_until` text DEFAULT '' NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`original_created_at` text NOT NULL,
	`created_by` text DEFAULT 'master-admin' NOT NULL,
	`deleted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_by` text DEFAULT 'master-admin' NOT NULL,
	`delete_reason` text DEFAULT 'Deleted from Master Panel' NOT NULL,
	`sheet_synced` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `original_total_amount_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `discount_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `discount_amount_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `coupon_id` integer REFERENCES coupons(id);--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `coupon_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `received_amount_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `provider_status` text DEFAULT 'created' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `reconciliation_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `master_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `reconciled_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `reconciled_by` text DEFAULT '' NOT NULL;