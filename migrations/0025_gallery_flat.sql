-- 相册集不再分“类别 > 相册 > 照片”三层：照片直接挂在相册集下，密码仍设在相册集上。
CREATE TABLE `gallery_photos_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`media_id` integer NOT NULL,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `gallery_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `gallery_photos_new` (`id`, `category_id`, `media_id`, `caption`, `sort_order`, `created_at`)
SELECT `gallery_photos`.`id`, `gallery_albums`.`category_id`, `gallery_photos`.`media_id`, `gallery_photos`.`caption`, `gallery_photos`.`sort_order`, `gallery_photos`.`created_at`
FROM `gallery_photos`
INNER JOIN `gallery_albums` ON `gallery_albums`.`id` = `gallery_photos`.`album_id`;
--> statement-breakpoint
DROP TABLE `gallery_photos`;
--> statement-breakpoint
ALTER TABLE `gallery_photos_new` RENAME TO `gallery_photos`;
--> statement-breakpoint
CREATE INDEX `category_idx_gallery_photos` ON `gallery_photos` (`category_id`);
--> statement-breakpoint
DROP TABLE `gallery_albums`;
