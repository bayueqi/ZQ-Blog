-- 置顶改为就地写进公开快照。把历史数据对齐，
-- 避免出现 posts.pinned_at 有值、快照里没有，导致前台顺序不跟着变。

UPDATE posts
SET public_snapshot_json = json_set(
  public_snapshot_json,
  '$.pinnedAt',
  strftime('%Y-%m-%dT%H:%M:%fZ', pinned_at, 'unixepoch')
)
WHERE public_snapshot_json IS NOT NULL
  AND pinned_at IS NOT NULL
  AND json_extract(public_snapshot_json, '$.pinnedAt') IS NULL;

UPDATE posts
SET public_snapshot_json = json_set(public_snapshot_json, '$.pinnedAt', NULL)
WHERE public_snapshot_json IS NOT NULL
  AND pinned_at IS NULL
  AND json_extract(public_snapshot_json, '$.pinnedAt') IS NOT NULL;
