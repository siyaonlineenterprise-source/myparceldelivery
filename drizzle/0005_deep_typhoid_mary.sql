CREATE TABLE `report_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`report_type` text NOT NULL,
	`date_from` text NOT NULL,
	`date_to` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`master_note` text DEFAULT '' NOT NULL,
	`report_url` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
