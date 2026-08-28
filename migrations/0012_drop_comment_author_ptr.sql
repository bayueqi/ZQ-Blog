-- Drop author_ptr column (DoH PTR reverse lookup removed)
-- SQLite 不支持直接 DROP COLUMN(旧版本),用 12 步重建表法兼容所有版本
-- 如果你的 SQLite >= 3.35.0,可以直接用:ALTER TABLE comments DROP COLUMN author_ptr;
-- 这里用通用安全写法:

CREATE TABLE `comments_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `content` text,
  `root_id` integer,
  `reply_to_comment_id` integer,
  `status` text DEFAULT 'verifying' NOT NULL,
  `ai_reason` text,
  `post_id` integer NOT NULL,
  `user_id` text,
  `author_ip` text,
  `author_region` text,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`root_id`) REFERENCES `comments`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (`reply_to_comment_id`) REFERENCES `comments`(`id`) ON UPDATE NO ACTION ON DELETE SET NULL,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE NO ACTION ON DELETE SET NULL
);

INSERT INTO `comments_new` (`id`, `content`, `root_id`, `reply_to_comment_id`, `status`, `ai_reason`, `post_id`, `user_id`, `author_ip`, `author_region`, `created_at`, `updated_at`)
SELECT `id`, `content`, `root_id`, `reply_to_comment_id`, `status`, `ai_reason`, `post_id`, `user_id`, `author_ip`, `author_region`, `created_at`, `updated_at` FROM `comments`;

DROP TABLE `comments`;
ALTER TABLE `comments_new` RENAME TO `comments`;

CREATE INDEX `comments_post_root_created_idx` ON `comments` (`post_id`, `root_id`, `created_at`);
CREATE INDEX `comments_user_created_idx` ON `comments` (`user_id`, `created_at`);
CREATE INDEX `comments_status_created_idx` ON `comments` (`status`, `created_at`);
CREATE INDEX `comments_global_created_idx` ON `comments` (`created_at`);
