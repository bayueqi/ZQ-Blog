# 已踩过的坑

按「现象 → 根因 → 处理」记录。遇到相似现象先对照这里，不要重新摸一遍。

## 手机端页头只剩一行计数

**现象**：文件管理、文章管理在手机上页头没有标题和按钮，只剩底部计数，与友链管理明显不同。

**根因**：页面自己的 CSS 在 `@media (max-width: 1023px)` 里把 `h1` 与 `.fuwari-heading-actions` 一起 `display: none`，打算「把按钮让给顶栏」，结果标题也一起消失。

**处理**：删掉隐藏规则，只保留间距收紧。顶栏不放主按钮后，这条规则彻底没有存在理由。

## 主按钮是灰色

**现象**：友链管理「添加友链」比其它页的主按钮浅。

**根因**：`<Button>` 省略 `variant`，落到默认次要样式。

**处理**：补 `variant="primary"`。

## 草稿相册在「最近编辑」显示已发布

**现象**：相册已设为草稿，概览最近编辑仍标「已发布」。

**根因**：`dashboard.data.ts` 的相册分支把 `published: true` 写死。

**处理**：改为 `category.publishedAt !== null`，并为 `gallery_categories` 增加 `published_at` 字段（迁移 `0032_gallery_published.sql`），列表与详情查询按该字段过滤。

## 「标为已处理」偶发失效

**现象**：点标为已处理，列表偶尔不变；再点一次才生效。

**根因**：先主动刷新列表、再写库，刷新拿到的还是旧数据，写完之后没有再次失效缓存。

**处理**：改为写完统一失效 `orpc.dashboard.key()` 与 `orpc.comments.admin.list.key()`，不再手工刷新。

## 自己的评论出现「标为已处理」

**处理**：列表渲染时判断 `comment.userId === session.user.id`，是本人则不显示该菜单项。

## 部署报 `KV namespace not found`

**现象**：`cf deploy` 失败，提示 KV 命名空间不存在。

**根因**：构建时没带环境变量，`cloudflare.config.ts` 把占位 ID（全零 UUID）写进了产物。

**处理**：带齐变量重新构建再部署。改动只在部署设置里补变量是没用的，产物已经固化。

## 迁移只执行了首条语句

**现象**：迁移文件里两条 SQL，线上只加了一列，另一列或回填没生效。

**根因**：`cf d1 migrations apply` 在该场景下只跑了首条语句，且不报错。

**处理**：用 `bunx wrangler d1 execute <db> --remote --json --command "..."` 逐条核对表结构，缺的补齐并回填存量数据。

## 生产未配 Turnstile 站点 key，评论与友链全失败

**根因**：`VITE_TURNSTILE_SITE_KEY` 是 Vite 构建期变量，没配就没有渲染出验证组件，前端提交直接被拒。

**处理**：把它加进构建变量后重新构建。Cloudflare Workers Builds 的变量与 Worker 运行时机密是两套，别只加后者。

## 清理词条后格式全变

**现象**：`bun run i18n:prune-unused -- --write` 跑完，`messages/*.json` 的 diff 覆盖全文件。

**根因**：脚本会重写数组与缩进格式。

**处理**：只用它输出未使用键的名单，再按原格式手工删除；删除后跑 `bun run i18n:compile` 与 `bun run i18n:verify`。

## 概览每次进入都重新查询

**根因**：`refetchOnMount: "always"`，每次挂载都打二十多条 SQL。

**处理**：去掉该项，依赖全局 `staleTime` 与页面级 `staleTime: 15s`。

## 批量删除很慢

**根因**：`for` 循环里逐条 `await` 删除。

**处理**：改为并发（清理未引用文件时每批 5 个），保留分批以避免打爆 D1 请求配额。

## 后台缩略图拉原图

**根因**：网格、列表、详情都用 `asset.url`。

**处理**：改用 `getMediaThumbSrc()`，网格与列表 400，详情 800，GIF/SVG 自动回退原图，地址 `useMemo` 缓存。

## 测试固定 5 个失败

- `tags-search` 3 个：用例向 FTS 索引写入不存在的文章 id，而搜索查询 `JOIN posts`，结果为空。
- 文章快照 2 个：期望值缺 `privacyProtected`、`visibility` 字段。

这两组属于用例本身待更新，不是代码回归。跑测试时以「失败数是否仍为 5、用例名是否相同」判断。
