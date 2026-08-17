INSERT INTO `vendors` (
	`business_name`,
	`contact_name`,
	`mobile`,
	`vendor_code`,
	`login_pin_hash`,
	`status`,
	`parcel_count`
)
SELECT
	'SIYA ENTERPRISE',
	'Meet Patel',
	'9999999999',
	'SIYA-DEMO-395008',
	'89a0b69e4e067cc99c3e493c96d34de347c9a057f2542c1af4c7b4721e2d6ebf',
	'active',
	0
WHERE NOT EXISTS (
	SELECT 1 FROM `vendors` WHERE UPPER(`business_name`) = 'SIYA ENTERPRISE'
);
--> statement-breakpoint
INSERT INTO `parcels` (
	`vendor_id`,
	`tracking_id`,
	`bag_id`,
	`upload_status`,
	`video_url`,
	`pincode`,
	`delivery_partner`
)
VALUES (
	(SELECT `id` FROM `vendors` WHERE UPPER(`business_name`) = 'SIYA ENTERPRISE' ORDER BY `id` LIMIT 1),
	'VL0084918478442',
	'SIYA-BAG-001',
	'uploaded',
	'https://www.youtube.com/embed/4wP1LIo-u2o',
	'395008',
	'Valmo'
)
ON CONFLICT(`tracking_id`) DO UPDATE SET
	`vendor_id` = excluded.`vendor_id`,
	`bag_id` = excluded.`bag_id`,
	`upload_status` = excluded.`upload_status`,
	`video_url` = excluded.`video_url`,
	`pincode` = excluded.`pincode`,
	`delivery_partner` = excluded.`delivery_partner`,
	`updated_at` = CURRENT_TIMESTAMP;
--> statement-breakpoint
INSERT INTO `parcels` (
	`vendor_id`,
	`tracking_id`,
	`bag_id`,
	`upload_status`,
	`video_url`,
	`pincode`,
	`delivery_partner`
)
VALUES (
	(SELECT `id` FROM `vendors` WHERE UPPER(`business_name`) = 'SIYA ENTERPRISE' ORDER BY `id` LIMIT 1),
	'1490838646330060',
	'SIYA-BAG-002',
	'uploaded',
	'https://www.youtube.com/embed/5cbnmSxRPN4',
	'395008',
	'Delhivery'
)
ON CONFLICT(`tracking_id`) DO UPDATE SET
	`vendor_id` = excluded.`vendor_id`,
	`bag_id` = excluded.`bag_id`,
	`upload_status` = excluded.`upload_status`,
	`video_url` = excluded.`video_url`,
	`pincode` = excluded.`pincode`,
	`delivery_partner` = excluded.`delivery_partner`,
	`updated_at` = CURRENT_TIMESTAMP;
--> statement-breakpoint
INSERT INTO `parcels` (
	`vendor_id`,
	`tracking_id`,
	`bag_id`,
	`upload_status`,
	`video_url`,
	`pincode`,
	`delivery_partner`
)
VALUES (
	(SELECT `id` FROM `vendors` WHERE UPPER(`business_name`) = 'SIYA ENTERPRISE' ORDER BY `id` LIMIT 1),
	'SF3701333915FPL',
	'SIYA-BAG-003',
	'uploaded',
	'https://www.youtube.com/embed/Qj-e_buy9lY',
	'395008',
	'Shadowfax'
)
ON CONFLICT(`tracking_id`) DO UPDATE SET
	`vendor_id` = excluded.`vendor_id`,
	`bag_id` = excluded.`bag_id`,
	`upload_status` = excluded.`upload_status`,
	`video_url` = excluded.`video_url`,
	`pincode` = excluded.`pincode`,
	`delivery_partner` = excluded.`delivery_partner`,
	`updated_at` = CURRENT_TIMESTAMP;
--> statement-breakpoint
INSERT INTO `parcels` (
	`vendor_id`,
	`tracking_id`,
	`bag_id`,
	`upload_status`,
	`video_url`,
	`pincode`,
	`delivery_partner`
)
VALUES (
	(SELECT `id` FROM `vendors` WHERE UPPER(`business_name`) = 'SIYA ENTERPRISE' ORDER BY `id` LIMIT 1),
	'13409694668054',
	'SIYA-BAG-004',
	'uploaded',
	'https://www.youtube.com/embed/hWXBxSw9pYI',
	'395008',
	'XpressBees'
)
ON CONFLICT(`tracking_id`) DO UPDATE SET
	`vendor_id` = excluded.`vendor_id`,
	`bag_id` = excluded.`bag_id`,
	`upload_status` = excluded.`upload_status`,
	`video_url` = excluded.`video_url`,
	`pincode` = excluded.`pincode`,
	`delivery_partner` = excluded.`delivery_partner`,
	`updated_at` = CURRENT_TIMESTAMP;
--> statement-breakpoint
UPDATE `vendors`
SET `parcel_count` = (
	SELECT COUNT(*) FROM `parcels` WHERE `parcels`.`vendor_id` = `vendors`.`id`
)
WHERE UPPER(`business_name`) = 'SIYA ENTERPRISE';
