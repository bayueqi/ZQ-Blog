-- 日常（朋友圈式短内容）：一条记录就是一段文字，可选配图和访问密码。
CREATE TABLE `moments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`body` text NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`access_password_hash` text,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `published_at_idx_moments` ON `moments` (`published_at`);
