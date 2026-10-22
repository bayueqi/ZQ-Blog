-- 相册集：类别 > 相册 > 照片，密码设置在类别上。
CREATE TABLE `gallery_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`cover_media_id` integer,
	`access_password_hash` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_categories_slug_unique` ON `gallery_categories` (`slug`);
--> statement-breakpoint
CREATE TABLE `gallery_albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`cover_media_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `gallery_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `category_idx_gallery_albums` ON `gallery_albums` (`category_id`);
--> statement-breakpoint
CREATE INDEX `slug_idx_gallery_albums` ON `gallery_albums` (`slug`);
--> statement-breakpoint
CREATE TABLE `gallery_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album_id` integer NOT NULL,
	`media_id` integer NOT NULL,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `gallery_albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `album_idx_gallery_photos` ON `gallery_photos` (`album_id`);
