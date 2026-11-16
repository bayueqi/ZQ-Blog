CREATE TABLE IF NOT EXISTS `content_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `content_revisions_target_created_idx` ON `content_revisions` (`target_type`,`target_id`,`created_at`);
