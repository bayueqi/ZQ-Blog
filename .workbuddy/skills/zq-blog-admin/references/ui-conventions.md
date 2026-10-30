# 后台页面结构与样式约定

后台所有管理页共用一套页头：**标题 + 描述行（计数）+ 主按钮**。改动任何一页前先对齐这张表，避免出现「别的页有、这页没有」的不一致。

## 页头清单

| 页面 | 标题 | 描述行 | 主按钮 |
| --- | --- | --- | --- |
| 概览 `/admin` | 由 hero 卡片承担 | — | 卡片内「新建文章」（`dashboard-hero-create`） |
| 文章管理 `/admin/posts` | 文章管理 | 共 N 篇文章 | 新建文章 |
| 评论管理 `/admin/comments` | 评论管理 | 共 N 条评论（全部 + 我的） | — |
| 日常 `/admin/moments` | 日常 | 共 N 条日常 | 写日常 |
| 相册集 `/admin/gallery` | 相册管理 | 共 N 个相册集 · M 张照片 | 新建相册 / 上传照片 |
| 相册详情 `/admin/gallery/$id` | 相册名 | 共 N 张照片 | 上传照片 |
| 友链管理 `/admin/friends` | 友链管理 | 共 N 个友链 | + 添加友链 |
| 文件管理 `/admin/media` | 文件管理 | 共 N 个文件 · 大小 | 上传文件 |

计数用词：评论、文章、日常用「条 / 篇 / 条」，友链、相册集、文件用「个」，照片用「张」。分隔符统一为中文间隔号 `·`，两侧各一个空格。

## 页头实现方式

两种写法，视觉结果相同，改动时保持该页原有写法的风格即可，不要混用：

- `src/components/ui/page-heading.tsx` 的 `PageHeader`：`title`、可选 `description`、可选 `actions`。actions 渲染进 `.fuwari-heading-actions`。评论管理与文件管理用它。
- 特性自有页头（`.post-list-heading`、`.friend-header`、`.moments-*` 等）：标题、计数、按钮直接写在页头容器内。

主按钮一律 `variant="primary"`。省略 variant 会落到默认次要样式（灰底），与其它页的蓝色主按钮并排时非常明显。

## 响应式断点

- `max-width: 1023px`：平板与手机，后台主要断点（`.media-workspace-header`、`.post-list-heading`、`.dashboard-*`）。
- `max-width: 767px`：更小屏才有差异的页面（`.friend-header`）。

窄屏规则只允许压缩间距与字号，不允许隐藏标题、计数或主按钮。历史问题正是这几条 `display: none`：

```css
/* 错误：窄屏把页头内容整块藏掉 */
@media (max-width: 1023px) {
  .xxx-header h1,
  .xxx-header .fuwari-heading-actions {
    display: none;
  }
}
```

窄屏需要收紧间距时，写成：

```css
@media (max-width: 1023px) {
  .xxx-header {
    margin-bottom: calc(10 * var(--admin-unit));
  }
  .xxx-header p {
    margin-top: 0;
  }
}
```

后台长度单位统一用 `calc(<数字> * var(--admin-unit))`，不要写裸 px。

## 移动端顶栏

顶栏标题来自路由 `loader` 返回的 `title`（`pageTitleFromMatches`），多级页面自动取最近一级带 `title` 的路由。系统设置这类多标签页统一推 `m.settings_header_title()`（系统设置），用 `setMobileTitle` 覆盖子页标题。

顶栏不放大按钮。`setPrimaryAction` 仍存在于 `admin-chrome.tsx`，但各管理页的主按钮应留在页头卡片里，与桌面端一致。只有编辑器例外——编辑器的保存在顶栏。

## 空状态

只保留一行灰色描述，不放大号空态标题、不配插图、不加操作引导：

```tsx
<p className="...text-muted-foreground">{m.xxx_empty()}</p>
```

已有实现参考：评论三档页签、禁言名单、日常、文件管理、API Key、最近编辑、分类/标签弹层。

页面内不写小字说明。按钮下方、标题下方、错误提示下方的灰色解释句（「点这里…」「没反应就…」）一律不加。

## 列表底部

不要在列表底部重复页头已有的计数。底部只在需要时出现：加载更多、加载失败重试、筛选「未引用」时的清理入口。三者都无则不渲染 footer，避免留下一条空条。

## 侧栏

`src/components/admin/side-bar.tsx` 定义导航项。文件管理的入口文案是「文件」，图标用 `FolderOpen`（曾用 `Image`，与图片语义重复）。

## 图片

后台列表与详情里的缩略图必须走变换地址，不要直接用 `asset.url`：

```ts
getMediaThumbSrc(asset.url, PUBLIC_IMAGE_WIDTH.thumb) // 400
getMediaThumbSrc(asset.url, PUBLIC_IMAGE_WIDTH.cover) // 详情预览 800
```

GIF 与 SVG 由该函数自动回退原图。地址用 `useMemo` 缓存，避免翻页时重复解析。

## 评论链接

评论落在三种内容上，链接的锚点不同，但都由同一个函数生成：`src/features/comments/comment-url.ts`。

| 目标 | 链接 |
| --- | --- |
| 文章 | `/post/{slug}?comment=N#comments` |
| 相册集 | `/gallery/{slug}?comment=N#comments` |
| 日常 | `/moments?comment=N#moment-{日常 id}` |

文章与相册的评论集中在页尾一个评论区，`#comments` 让浏览器先落到区块；日常是时间流，每条默认收起评论，锚点必须指向那一条日常，否则前端不知道展开谁。

**不要在 SQL 或组件里自己拼这类 URL。** 后台概览与评论管理列表的 `targetPath` 由 `dashboard.service.ts` 的 `commentTargetPath()` 调用同一函数得出；`dashboard.data.ts` 只查 `targetSlug`（文章 `public_slug`、相册 `slug`），不再拼字符串。

页面内的实际定位由 `useScrollToComment` 完成（轮询 `comment-<id>` 节点并居中），hash 只是无 JS 时的兜底，两者不冲突。

同一个页面里不要出现两个 `id="comments"`：相册页曾在外层容器和 `CommentSection` 的 `<section>` 上各写一次，锚点会命中前者。
