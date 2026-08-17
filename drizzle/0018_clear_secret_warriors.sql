CREATE TABLE `buyer_leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_code` text NOT NULL,
	`contact_name` text NOT NULL,
	`mobile` text NOT NULL,
	`whatsapp` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`business_name` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`marketplace` text NOT NULL,
	`monthly_orders` integer DEFAULT 0 NOT NULL,
	`plan_name` text NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`preferred_contact_time` text DEFAULT 'Any time' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`purchase_stage` text DEFAULT 'Day 1 Purchase' NOT NULL,
	`follow_up_status` text DEFAULT 'new' NOT NULL,
	`customer_decision` text DEFAULT 'pending' NOT NULL,
	`next_follow_up_at` text DEFAULT '' NOT NULL,
	`master_note` text DEFAULT '' NOT NULL,
	`last_contacted_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_leads_lead_code_unique` ON `buyer_leads` (`lead_code`);