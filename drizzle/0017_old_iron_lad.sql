CREATE TABLE `vendor_devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`device_token` text NOT NULL,
	`ip_hash` text NOT NULL,
	`masked_ip` text DEFAULT '' NOT NULL,
	`ip_change_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendor_devices_vendor_device_unique` ON `vendor_devices` (`vendor_id`,`device_token`);--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `user_limit` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_orders` ADD `extra_user_rate_paise` integer DEFAULT 9900 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendor_sessions` ADD `device_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendor_sessions` ADD `ip_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vendor_subscriptions` ADD `user_limit` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendor_subscriptions` ADD `extra_user_rate_paise` integer DEFAULT 9900 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `user_limit` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `extra_user_rate_paise` integer DEFAULT 9900 NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `ip_policy_blocked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `vendors` ADD `ip_blocked_at` text DEFAULT '' NOT NULL;