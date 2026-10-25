CREATE TABLE `weekly_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`reviewed_count` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
ALTER TABLE `loops` ADD `decided_at` integer;--> statement-breakpoint
ALTER TABLE `loops` ADD `reviewed_at` integer;--> statement-breakpoint
-- Backfill: until now a loop was last changed when it was decided, so updated_at stands in for both.
UPDATE `loops` SET `decided_at` = `updated_at`, `reviewed_at` = `updated_at` WHERE `state` != 'inbox';
