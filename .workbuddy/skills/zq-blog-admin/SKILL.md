---
name: zq-blog-admin
description: 维护 ZQ-Blog 管理后台与发布流程。用于修改后台页面的文案与 i18n 词条、页头与移动端布局、计数与空状态样式，跑通类型检查与多语言校验，构建并部署到 Cloudflare Workers。技术栈为 TanStack Start + React 19 + Drizzle/D1 + oRPC + Paraglide。
agent_created: true
---

# ZQ-Blog 后台维护

## 适用场景

- 改管理后台某页的标题、按钮、计数、空状态文案。
- 调整后台页头结构、移动端断点下的显示/隐藏。
- 中英文词条同步、清理无用词条。
- 提交前校验，以及构建部署到 Cloudflare Workers。

不适用于重写业务逻辑或改数据库表结构——那类改动先读 `migrations/` 与对应 `*.data.ts`。

## 项目定位

| 位置 | 内容 |
| --- | --- |
| `src/routes/admin/*` | 后台路由，`index.tsx` 里常带 `loader` 返回 `title`，供浏览器标题与手机顶栏使用 |
| `src/features/<feature>/components/` | 页面主体，样式与组件同目录（`.tsx` + `.css`） |
| `src/components/admin/admin-chrome.tsx` | 后台外壳上下文：`setMobileTitle`、`setPrimaryAction` |
| `src/components/ui/page-heading.tsx` | `PageHeader`（`fuwari-page-heading`）与 `SectionHeading` |
| `src/routes/admin/route.tsx` | 布局与 `pageTitleFromMatches`（从 loader 的 `title` 推导顶栏标题） |
| `messages/zh.json`、`messages/en.json` | Paraglide 词条，键名必须两边一致 |
| `src/paraglide/` | 编译产物，由 `bun run i18n:compile` 生成，不手改 |

数据层按特性拆分：`<feature>.schema.ts`（Zod/oRPC 契约）、`<feature>.data.ts`（SQL）、`<feature>.service.ts`（业务）。

## 流程 A：改文案

1. 同时在 `messages/zh.json` 与 `messages/en.json` 按同一键名修改，保持原有缩进与数组格式。
2. 运行 `bun run i18n:compile` 重新生成 `src/paraglide/`。
3. 运行 `bun run i18n:verify` 确认两语言键集合一致。
4. 页面里通过 `m.<key>()` 取文案，禁止在组件里硬编码中文。

改词条值不要顺手改键名：键名被 `src/paraglide` 与组件共同引用，改键名要同步全部引用点。

## 流程 B：改页头与布局

后台页面的统一结构、断点规则、计数文案写法、空状态规范见 `references/ui-conventions.md`。改样式前先读它，避免又出现「某页与其它页不一致」。

核心约束：

- 页头三件套（标题 + 描述行 + 主按钮）在任何宽度都保留，不要用 `display: none` 藏掉。
- 主按钮固定 `variant="primary"`，否则落到次要样式（灰色），与其它页不一致。
- 不往移动端顶栏塞主按钮；顶栏只负责标题与抽屉入口。
- 空状态只用一行灰色描述，不放大图标、不加操作提示小字。

## 流程 C：提交前校验

```bash
bun run check          # orpc:contract + worker 类型 + oxlint + oxfmt --check + tsc --noEmit
bun run i18n:verify    # 中英词条键集合一致
bunx vitest run        # 单元与集成测试
```

`bun run check` 里的 `orpc:contract` 会重写 `src/lib/orpc/contract.generated.json`，改过 oRPC 契约后必须提交这份产物。

测试有 5 个已知失败，属历史用例问题，不是回归：3 个 `tags-search` 用例向索引写入不存在的文章 id，而搜索查询 `JOIN posts`；2 个文章快照用例的期望值缺 `privacyProtected` / `visibility`。判断标准是失败数仍为 5 且用例名不变。

## 流程 D：发布

完整命令、构建变量清单与产物核对方式见 `references/deploy.md`。要点：

- 构建和部署都必须带环境变量，缺变量会落到占位 ID，部署报 `KV namespace not found`。
- `VITE_TURNSTILE_SITE_KEY` 是构建期变量，漏配会让评论与友链提交全部失败。
- 清空 `.cloudflare/output` 再构建，避免旧 CSS 残留。
- Git 操作统一加 `-c core.autocrlf=false`，避免 CRLF 污染全仓库 diff。

## 红线

- 不把 `.dev.vars`、`.env`、Cloudflare API Token、Account ID、D1/KV 真实 ID、生产域名写进仓库任何文件，包括本文档与脚本。脚本只从环境变量读取。
- 只改用户点名的那一处。顺手优化、顺手改图标配色、顺手补文档都属于越界，未经同意不做。
- 页面不加解释性小字（按钮下方、标题下方的灰色提示句）。
- 不在编译产物 `src/paraglide/`、`.cloudflare/output/`、`.wrangler/` 里做手工修改。

## 参考

- `references/ui-conventions.md` — 后台页面结构与样式约定
- `references/deploy.md` — 构建部署与环境变量
- `references/pitfalls.md` — 已踩过的坑与验证方式
