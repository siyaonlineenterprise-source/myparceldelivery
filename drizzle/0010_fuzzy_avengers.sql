CREATE TABLE `marketplace_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`marketplace` text DEFAULT 'Meesho' NOT NULL,
	`order_id` text DEFAULT '' NOT NULL,
	`tracking_id` text NOT NULL,
	`tracking_key` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_address` text DEFAULT '' NOT NULL,
	`customer_pincode` text DEFAULT '' NOT NULL,
	`label_url` text DEFAULT '' NOT NULL,
	`order_date` text NOT NULL,
	`packing_status` text DEFAULT 'pending' NOT NULL,
	`packed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_orders_vendor_tracking_unique` ON `marketplace_orders` (`vendor_id`,`tracking_key`);