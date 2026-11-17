-- 私密内容对外只用编号：链接里不再出现标题，标题也不出现在列表里。
ALTER TABLE gallery_categories ADD COLUMN public_slug TEXT;

-- 公开的相册沿用原来的链接。
UPDATE gallery_categories SET public_slug = slug;

-- 私密的相册按 id 顺序编号，改成「私密相册-1」这样的占位链接。
UPDATE gallery_categories
SET public_slug = '私密相册-' || (
  SELECT COUNT(*) FROM gallery_categories AS earlier
  WHERE earlier.access_password_hash IS NOT NULL
    AND earlier.id <= gallery_categories.id
)
WHERE access_password_hash IS NOT NULL;

-- 私密文章同样重新编号，真实链接留在 slug 列里，解锁后再跳过去。
UPDATE posts
SET public_slug = '私密文章-' || (
  SELECT COUNT(*) FROM posts AS earlier
  WHERE earlier.visibility = 'password'
    AND earlier.id <= posts.id
)
WHERE visibility = 'password';

-- 公开快照里也存了一份链接，一起换掉。
UPDATE posts
SET public_snapshot_json = json_set(public_snapshot_json, '$.slug', public_slug)
WHERE public_snapshot_json IS NOT NULL
  AND public_slug IS NOT NULL
  AND json_extract(public_snapshot_json, '$.slug') <> public_slug;
