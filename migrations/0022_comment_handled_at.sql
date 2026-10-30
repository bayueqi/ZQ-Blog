-- When an Admin replied to or marked a Comment handled; it then leaves the
-- dashboard's unreplied list. Existing Comments start unhandled.
ALTER TABLE `comments` ADD `handled_at` integer;
