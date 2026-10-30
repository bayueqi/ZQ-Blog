-- 日常与相册集也能置顶：置顶的排在列表最前面，其余保持原顺序。
ALTER TABLE `moments` ADD `pinned_at` integer;
--> statement-breakpoint
ALTER TABLE `gallery_categories` ADD `pinned_at` integer;
