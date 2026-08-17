DELETE FROM `return_claims`;
--> statement-breakpoint
DELETE FROM `return_proofs`;
--> statement-breakpoint
DELETE FROM `report_requests`;
--> statement-breakpoint
DELETE FROM `parcels`;
--> statement-breakpoint
DELETE FROM `pin_reset_requests`;
--> statement-breakpoint
UPDATE `vendors` SET `parcel_count` = 0;
