CREATE TABLE `return_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_proof_id` integer NOT NULL,
	`vendor_id` integer NOT NULL,
	`tracking_id` text NOT NULL,
	`portal` text DEFAULT 'Meesho' NOT NULL,
	`issue_type` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'raised' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`return_proof_id`) REFERENCES `return_proofs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `return_proofs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`tracking_id` text NOT NULL,
	`return_type` text NOT NULL,
	`upload_status` text DEFAULT 'pending' NOT NULL,
	`video_url` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
