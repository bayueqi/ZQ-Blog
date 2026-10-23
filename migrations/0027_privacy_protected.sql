-- 隐私保护：密码访问时再关掉标题、描述、时间、封面等元信息。
ALTER TABLE `posts` ADD `privacy_protected` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `gallery_categories` ADD `privacy_protected` integer DEFAULT false NOT NULL;
