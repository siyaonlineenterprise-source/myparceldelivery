CREATE TABLE `follow_ups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`claim_id` integer NOT NULL,
	`vendor_id` integer NOT NULL,
	`tracking_id` text NOT NULL,
	`person_name` text NOT NULL,
	`contact_number` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`sheet_synced` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `return_claims`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `return_claims` ADD `claim_video_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `drive_folder_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `packing_folder_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `return_folder_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `claims_folder_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `vendors` SET
	`drive_folder_id` = '1IjsaEGJms0RPhcQ59_5PORIDQxRXwnsT',
	`packing_folder_id` = '1Yj4Km4ShuIgLyROMFhQSp_hVJfgWpcJs',
	`return_folder_id` = '1S0PCU1O4SV_fZXtcE2syb7YzymOfsk8P',
	`claims_folder_id` = '1UFJNgXssHamBMHG8qhEV91o70kShLs4i'
WHERE REPLACE(REPLACE(`vendor_code`, ' ', ''), '-', '') = 'SIYA001';--> statement-breakpoint
UPDATE `vendors` SET
	`drive_folder_id` = '1Ma23EflqXhuLUzoGCAsJbbCglBAwN7Pk',
	`packing_folder_id` = '105hc-khhZAedRg5Yz8igDzC4IyUp6mmm',
	`return_folder_id` = '1wNeAPAwBvkz1KgQS8H-58uIZWpYg2GvS',
	`claims_folder_id` = '1JuvyO_rcvM2wLjSfBx8sFWe45oEDnSFp'
WHERE REPLACE(REPLACE(`vendor_code`, ' ', ''), '-', '') = 'KHODALTEX';
