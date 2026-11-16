ALTER TABLE `gallery_categories` ADD `published` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `gallery_categories` SET `published` = 1 WHERE `published_at` IS NOT NULL;
