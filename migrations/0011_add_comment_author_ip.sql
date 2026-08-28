-- Add author IP / PTR / region info to comments table
ALTER TABLE `comments` ADD `author_ip` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `author_ptr` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `author_region` text;
