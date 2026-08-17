CREATE TABLE `settlement_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`marketplace` text DEFAULT 'Meesho' NOT NULL,
	`order_ref` text NOT NULL,
	`tracking_id` text DEFAULT '' NOT NULL,
	`gross_amount_paise` integer DEFAULT 0 NOT NULL,
	`deductions_paise` integer DEFAULT 0 NOT NULL,
	`net_paid_paise` integer DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`payment_date` text DEFAULT '' NOT NULL,
	`utr` text DEFAULT '' NOT NULL,
	`source_file` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_records_vendor_marketplace_order_unique` ON `settlement_records` (`vendor_id`,`marketplace`,`order_ref`);--> statement-breakpoint
ALTER TABLE `marketplace_orders` ADD `payment_mode` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_orders` ADD `order_amount_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketplace_orders` ADD `marketplace_status` text DEFAULT '' NOT NULL;