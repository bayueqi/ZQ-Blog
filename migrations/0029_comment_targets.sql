-- Comments were bound to Posts only (`post_id`), so a Moment or a Gallery
-- Category could not be discussed. They now point at any content through
-- (`target_type`, `target_id`); existing rows are Posts.
--
-- `post_id` carried an ON DELETE CASCADE that this table loses with the column.
-- Posts, Moments and Gallery Categories delete their own Comments instead, see
-- the `remove*` paths in their services.
CREATE TABLE `comments_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text,
	`root_id` integer,
	`reply_to_comment_id` integer,
	`status` text DEFAULT 'published' NOT NULL,
	`target_type` text DEFAULT 'post' NOT NULL,
	`target_id` integer NOT NULL,
	`user_id` text,
	`handled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`root_id`) REFERENCES `comments_new`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_comment_id`) REFERENCES `comments_new`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `comments_new` (`id`, `content`, `root_id`, `reply_to_comment_id`, `status`, `target_type`, `target_id`, `user_id`, `handled_at`, `created_at`, `updated_at`)
SELECT `id`, `content`, `root_id`, `reply_to_comment_id`, `status`, 'post', `post_id`, `user_id`, `handled_at`, `created_at`, `updated_at` FROM `comments`;
--> statement-breakpoint
DROP TABLE `comments`;
--> statement-breakpoint
ALTER TABLE `comments_new` RENAME TO `comments`;
--> statement-breakpoint
CREATE INDEX `comments_target_root_created_idx` ON `comments` (`target_type`,`target_id`,`root_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `comments_target_status_idx` ON `comments` (`target_type`,`target_id`,`status`);
--> statement-breakpoint
CREATE INDEX `comments_user_created_idx` ON `comments` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `comments_status_created_idx` ON `comments` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `comments_global_created_idx` ON `comments` (`created_at`);
