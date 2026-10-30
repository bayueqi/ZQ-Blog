-- 相册集也有草稿/发布：`published_at` 为空即草稿，前台不下发。
-- 已有的相册按创建时间补成已发布，避免升级后整站相册消失。
ALTER TABLE `gallery_categories` ADD `published_at` integer;
--> statement-breakpoint
UPDATE `gallery_categories`
SET `published_at` = coalesce(`created_at`, unixepoch())
WHERE `published_at` IS NULL;
