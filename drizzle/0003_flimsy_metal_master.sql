CREATE TABLE `parcels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`tracking_id` text NOT NULL,
	`bag_id` text NOT NULL,
	`upload_status` text DEFAULT 'pending' NOT NULL,
	`video_url` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`customer_mobile` text DEFAULT '' NOT NULL,
	`pincode` text DEFAULT '' NOT NULL,
	`delivery_partner` text DEFAULT 'Pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parcels_tracking_id_unique` ON `parcels` (`tracking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `parcels_bag_id_unique` ON `parcels` (`bag_id`);