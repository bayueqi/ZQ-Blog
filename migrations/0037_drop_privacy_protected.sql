-- 隐私保护开关下线：设了密码就是私密，这一列不再有含义。
ALTER TABLE `posts` DROP COLUMN `privacy_protected`;
--> statement-breakpoint
ALTER TABLE `gallery_categories` DROP COLUMN `privacy_protected`;
