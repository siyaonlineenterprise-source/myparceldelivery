CREATE TABLE `deleted_vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`business_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`mobile` text NOT NULL,
	`vendor_code` text NOT NULL,
	`parcel_count` integer DEFAULT 0 NOT NULL,
	`original_created_at` text NOT NULL,
	`deleted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approval_status` text DEFAULT 'none' NOT NULL,
	`requested_business_name` text DEFAULT '' NOT NULL,
	`requested_contact_name` text DEFAULT '' NOT NULL,
	`requested_vendor_code` text DEFAULT '' NOT NULL,
	`requested_pin_hash` text DEFAULT '' NOT NULL,
	`approval_requested_at` text DEFAULT '' NOT NULL,
	`approved_at` text DEFAULT '' NOT NULL,
	`sheet_synced` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deleted_vendors_vendor_id_unique` ON `deleted_vendors` (`vendor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `deleted_vendors_mobile_unique` ON `deleted_vendors` (`mobile`);--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_mobile_unique` ON `vendors` (`mobile`);