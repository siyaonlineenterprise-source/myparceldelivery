ALTER TABLE `return_claims` ADD `saved_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `customer_video_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parcel_id` integer NOT NULL,
	`vendor_id` integer NOT NULL,
	`customer_mobile` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`parcel_id`) REFERENCES `parcels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_video_views_mobile_idx` ON `customer_video_views` (`customer_mobile`);
--> statement-breakpoint
INSERT INTO `customer_video_views` (`parcel_id`, `vendor_id`, `customer_mobile`)
SELECT `id`, `vendor_id`, `customer_mobile`
FROM `parcels`
WHERE LENGTH(TRIM(`customer_mobile`)) = 10;
