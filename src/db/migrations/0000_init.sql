CREATE TABLE `daily_closes` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`resolved_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `loops` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`state` text NOT NULL,
	`next_action` text,
	`due_at` integer,
	`waiting_on` text,
	`revisit_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `loops_state_idx` ON `loops` (`state`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
