-- 自建访客统计：按 UTC 日 + 国家 + 浏览器 + 设备 + 系统累加次数，一组合一行。
CREATE TABLE `visit_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`country` text NOT NULL,
	`browser` text NOT NULL,
	`device` text NOT NULL,
	`os` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_dimensions_idx_visit_stats` ON `visit_stats` (`day`,`country`,`browser`,`device`,`os`);
