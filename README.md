# ZQ-Blog

ZQ-Blog 是一个深度拥抱 Cloudflare 生态的开源独立博客系统。前端基于 React 19 和 TanStack 现代全栈框架构建，界面走清新简约的卡片风格；后端完全运行于 Cloudflare Workers 边缘网络，搭配 D1、R2、KV 与异步队列，无需传统服务器即可享受极速的全球访问体验与近乎零成本的运维。

[仓库地址](https://github.com/bayueqi/ZQ-Blog) · [功能特性](#功能特性) · [技术栈](#技术栈) · [部署](#部署) · [本地开发](#本地开发) · [文档](#文档)

---



> [!NOTE]
> 本项目专为 Cloudflare Workers 边缘运行时设计。

## 功能特性

- 📝 **创作与内容管理**
  - **现代化富文本编辑器**：基于 TipTap 与 Shiki，原生支持代码语法高亮、数学公式排版、多尺寸媒体插入与文章封面。
  - **私密文章**：每篇文章可单独设置访问密码。首页照常列出标题与摘要，点进正文时才校验密码，未解锁读者拿不到任何正文内容，搜索引擎、RSS 与站内全文检索同样不收录正文。管理员登录后免密查看。
  - **相册集**：一个相册集就是一组照片，建好之后点进去直接上传，不再分中间的层级。每个相册集可以单独设置访问密码，未解锁时不返回任何照片。
  - **版本快照与历史回滚**：发布文章时自动归档快照，可随时按发布时间比对差异并一键恢复至任意历史版本。
  - **分类与标签体系**：支持文章单分类与多标签灵活组合筛选。
  - **站内实时全文检索**：用 Cloudflare D1 FTS 索引已发布文章的标题、摘要、分类、标签与正文。

- 💬 **互动与读者体验**
  - **评论与社区互动**：支持嵌套层级回复、访客防刷保护、评论软删除与违规用户禁言管理。
  - **友情链接流转**：前台提供规范的申请表单，后台支持一键审核通过、驳回反馈与邮件即时联动。
  - **国际化多语言**：公开阅读界面与管理后台均完整支持中英文无缝切换。

- ⚡ **边缘基础设施**
  - **全 Serverless 存储栈**：以 Cloudflare D1 作为主关系型数据库，KV 承担高频缓存，Durable Objects 负责精准访问限流。
  - **全球静态资产加速**：媒体文件直存 R2 存储桶，配合 Cloudflare Image Resizing 实现实时图片缩放与格式优化。
  - **异步队列事件解耦**：通知邮件发送与 Webhook 派发经由 Cloudflare Queues 异步队列处理，接口响应零阻塞。

- 🛠️ **系统与扩展能力**
  - **安全身份认证**：集成 Better Auth，原生支持邮箱密码账号体系与 GitHub OAuth 快捷登录。
  - **通知推送**：新评论、回复和友链申请可推送到 Telegram、Discord、飞书、钉钉、企业微信、Bark、ntfy，或带签名的通用 JSON 与自定义模板，见 [Webhook 推送](./docs/webhook.md)。
  - **开放 API 接口**：支持在后台签发 API Key，通过规范化 OpenAPI / oRPC 接口无缝对接第三方自动化工具或发布脚本。
  - **自建访客统计**：不依赖任何第三方脚本，按浏览器、设备、操作系统、地区统计访问量，图表直接长在后台概览里，数据存在自己的 D1。
  - **SEO**：开箱支持 Canonical、Schema.org、RSS / Atom / JSON Feed、Sitemap 与 Robots 标准。

## 技术栈

| 模块 | 选型 | 说明 |
| :--- | :--- | :--- |
| **边缘运行时** | Cloudflare Workers | 全球边缘免运维托管与服务端流式渲染（SSR） |
| **数据与存储** | Cloudflare D1 + R2 + KV | 关系型数据库（含全文检索）、对象存储与边缘键值缓存 |
| **异步与限流** | Cloudflare Queues + DO | 异步任务解耦队列与 Durable Objects 请求限流 |
| **全栈框架** | TanStack Start + Router + Query | 现代全栈路由系统、服务端数据预取与水合 |
| **前端技术** | React 19 + Tailwind CSS 4 | 现代化组件开发与主题样式系统 |
| **API 与 ORM** | oRPC + Drizzle ORM | 端到端类型安全的 OpenAPI 接口与 SQL ORM |
| **身份认证** | Better Auth | 边缘兼容的现代化身份验证服务 |
| **富文本** | TipTap + Shiki | 可扩展的所见即所得编辑器与代码高亮引擎 |

### 数据放在哪

每种数据都放在它最合适的组件上，不混用：

| 数据 | 放在 | 原因 |
| :--- | :--- | :--- |
| 文章、评论、友链、相册、访客统计 | D1 | 需要事务、唯一索引和聚合查询；访客统计靠 `INSERT … ON CONFLICT` 累加，一天一个组合一行 |
| 公开页缓存、站点配置、版本检查结果 | KV | 只读为主、按 TTL 过期；KV 没有原子自增，也不能做计数 |
| 图片与附件 | R2 | 大对象存储，配合 Images 按需缩放 |
| 邮件与 Webhook 派发 | Queues | 异步重试，不阻塞请求 |

> [!NOTE]
> KV 是最终一致的，写入后其他节点最长要几十秒才看得到，而且免费额度只够每天 1000 次写入，所以它不承担任何计数或强一致读写；需要数字准确的地方一律走 D1。

## 部署

整套服务跑在 Cloudflare 上，不用准备服务器，也不需要自己装数据库。从建资源到绑定域名的完整步骤、变量清单和常见报错都在 [部署文档](./docs/deployment.md)。

只有三件事需要记：

- 构建命令 `bun run build`，部署命令 `bun run deploy`（它会先对线上 D1 执行迁移，再发布 Worker）。
- 构建变量填资源信息（D1、KV、R2、Queue、域名），运行时机密全部勾选 Secret。
- 数据库里的第一个登录用户自动成为管理员。

## 本地开发

开发环境要求：[Bun](https://bun.sh) >= 1.3，Node >= 24（见 `.node-version`）。

### 1. 安装依赖与初始化配置

```bash
bun install

# 复制本地配置文件模板
cp .env.example .env
cp .dev.vars.example .dev.vars
```

参考 `.env` 与 `.dev.vars` 中的注释完成基础项配置，其中 `BETTER_AUTH_SECRET` 必须替换为真实随机值。本地开发通过 Miniflare 模拟 D1、KV 和 R2 存储服务，Worker 配置位于 `cloudflare.config.ts`，未设置部署变量时会使用占位符直接启动。

### 2. 初始化本地数据库

```bash
bun db:migrate:local
```

### 3. 启动本地开发服务

```bash
bun dev
```

在浏览器中打开 `http://localhost:3000` 即可开始预览。首次冷启动需要预打包依赖，可能耗时数分钟；服务仅监听 `localhost`，用 `127.0.0.1` 打不开。

> [!TIP]
> - `.dev.vars` 里 `ENVIRONMENT=dev` 时不会真实发信，验证链接直接打在控制台。邮箱注册需要 `system_config` 表中存在 SMTP 配置，否则注册入口会被关闭；本地可改为 GitHub OAuth 登录，或直接往 `users` 表插入账号。
> - 本地首个注册的账号会自动赋予管理员权限。
> - 修改数据库中的站点配置后，需要清空 `.wrangler/state/v3/kv` 缓存，否则 `config.system` 会保持旧值一小时。

### 常用开发脚本

| 命令 | 说明 |
| :--- | :--- |
| `bun dev` | 启动本地开发服务（默认监听端口 3000） |
| `bun check` | 提交前综合检查（包含 OpenAPI 合约生成、代码格式校验、Lint 与 TypeScript 类型检查） |
| `bun test` | 执行全量集成与单元测试套件 |
| `bun db:generate` | 依据 schema 变更生成新的 D1 迁移文件 |
| `bun db:migrate:local` | 对本地模拟数据库应用 D1 数据库迁移 |
| `bun db:migrate` | 对线上 D1 数据库应用迁移 |
| `bun db:studio` | 启动本地 Drizzle Studio 可视化数据库管理界面 |
| `bun i18n:verify` | 检查并校验多语言词条键值完整性（zh / en 一致性） |
| `bun i18n:compile` | 重新编译并生成 Paraglide 多语言运行时产物 |

## 文档

| 文档 | 内容 |
| :--- | :--- |
| [部署](./docs/deployment.md) | 在控制台里从零到上线：Git 仓库、OAuth、D1 / R2 / KV / Queue、构建变量、域名、常见报错 |
| [Webhook 推送](./docs/webhook.md) | 各渠道怎么填、通用 JSON 的字段、HMAC 签名校验、自定义模板变量 |

## 开源协议

本项目采用 [GPL-3.0](https://github.com/bayueqi/ZQ-Blog/blob/main/LICENSE) 协议开源。
