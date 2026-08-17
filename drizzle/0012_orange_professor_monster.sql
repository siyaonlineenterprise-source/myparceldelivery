CREATE TABLE `payment_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`plan_name` text NOT NULL,
	`monthly_video_credits` integer NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`base_amount_paise` integer NOT NULL,
	`gst_amount_paise` integer NOT NULL,
	`total_amount_paise` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`razorpay_order_id` text NOT NULL,
	`razorpay_payment_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_razorpay_order_id_unique` ON `payment_orders` (`razorpay_order_id`);--> statement-breakpoint
CREATE TABLE `vendor_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vendor_id` integer NOT NULL,
	`plan_name` text NOT NULL,
	`monthly_video_credits` integer NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`base_amount_paise` integer NOT NULL,
	`gst_amount_paise` integer NOT NULL,
	`total_amount_paise` integer NOT NULL,
	`razorpay_payment_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendor_subscriptions_vendor_id_unique` ON `vendor_subscriptions` (`vendor_id`);