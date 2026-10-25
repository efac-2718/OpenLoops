CREATE TABLE `ai_suggestions` (
	`loop_id` text PRIMARY KEY NOT NULL,
	`answer` text NOT NULL,
	`loop_updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
