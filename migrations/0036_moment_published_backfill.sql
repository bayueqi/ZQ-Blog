-- 升级前没有草稿这一层，所有日常都是公开的；`published` 默认 0 会让老数据从前台消失。
-- 0033 只回填了带发布时间的行，这里把剩下的也补上。
UPDATE `moments` SET `published` = 1 WHERE `published` = 0;
--> statement-breakpoint
UPDATE `gallery_categories` SET `published` = 1 WHERE `published` = 0;
