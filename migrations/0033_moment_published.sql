ALTER TABLE `moments` ADD `published` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `moments` SET `published` = 1 WHERE `published_at` IS NOT NULL;
