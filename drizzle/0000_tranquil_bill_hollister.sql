CREATE TABLE `vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`mobile` text NOT NULL,
	`vendor_code` text NOT NULL,
	`login_pin_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`parcel_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_vendor_code_unique` ON `vendors` (`vendor_code`);