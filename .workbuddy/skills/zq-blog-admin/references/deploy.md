# 构建与部署

部署目标是 Cloudflare Workers，配套 D1、KV、R2、Queues。所有真实凭据只存在于本机环境变量与 Cloudflare 控制台，任何情况下都不写进仓库文件。

## 环境变量

构建与部署都读同一组变量，缺一项就会把占位值写进产物。

| 变量 | 说明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 部署凭据，具备 Workers、D1、KV、R2、Queues、域名权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID |
| `WORKER_NAME` | Worker 名称，需与 Cloudflare 上的应用名一致 |
| `DOMAIN` | 博客域名，纯域名不带协议，例如 `blog.example.com` |
| `D1_DATABASE_ID` | D1 数据库 UUID |
| `KV_NAMESPACE_ID` | KV 命名空间 ID |
| `BUCKET_NAME` | R2 存储桶名称 |
| `QUEUE_NAME` | 队列名称 |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile 站点 key，**构建期注入**，改后必须重新构建 |
| `ROUTE` / `ZONE_NAME` | 可选。`ROUTE=1` 改用 Workers Routes 绑定 |

`cloudflare.config.ts` 的取值顺序是「环境变量 → 占位值」。缺少 `KV_NAMESPACE_ID` 时产物里会写成全零 ID，部署阶段才报错。

## 本地构建并部署

```bash
export CLOUDFLARE_API_TOKEN="..."      # 从本机环境或密码管理器注入
export CLOUDFLARE_ACCOUNT_ID="..."
export WORKER_NAME="zq-blog"
export DOMAIN="blog.example.com"
export D1_DATABASE_ID="..."
export KV_NAMESPACE_ID="..."
export BUCKET_NAME="..."
export QUEUE_NAME="..."
export VITE_TURNSTILE_SITE_KEY="..."

rm -rf .cloudflare/output
bun run build
bunx cf deploy --prebuilt
```

Windows 下清目录用 PowerShell，避免 Git Bash 删除大目录时卡住：

```powershell
$p = "C:\path\to\repo\.cloudflare\output"
if (Test-Path $p) { [System.IO.Directory]::Delete($p, $true) }
```

`scripts/deploy.ps1` 把这串流程固化下来，只从环境变量读值，缺变量直接中止。

`bun run build` 内部依次执行 `orpc:contract`（含 `i18n:compile`）、`cf build`、SSR chunk graph 分析。构建失败先看是否 cargo-cult 了旧的 `.cloudflare/output`。

## 需要迁移时的顺序

`bun run deploy` 等于 `cf d1 migrations apply` + `cf deploy --prebuilt`，Cloudflare Workers Builds 用的就是它。手工部署时若带了新迁移，按同一顺序执行：

```bash
bun run db:migrate
bunx cf deploy --prebuilt
```

`cf d1 migrations apply` 存在只执行首条语句的情况，一条迁移文件里写多条 SQL 时，后面的语句可能没落库。执行完必须核对：

```bash
bunx wrangler d1 execute <D1_DATABASE_ID> --remote --json \
  --command "select name from pragma_table_info('gallery_categories')"
```

字段没加上的，用 `wrangler d1 execute --remote` 手工补齐，并对存量行做回填（例如 `update ... set published_at = coalesce(created_at, unixepoch())`）。

## 产物核对

部署前确认新规则真的进了 CSS——构建产物有哈希文件名，缓存的旧文件很容易骗过眼睛：

```bash
grep -rl "media-workspace-header" .cloudflare/output/v0/workers/default/assets/assets/*.css
```

再看具体规则：

```bash
grep -oh "media-workspace-header[^}]*}" <命中的 css> | head
```

## 发布到 GitHub

```bash
git -c core.autocrlf=false add -A
git -c core.autocrlf=false commit -m "fix: ..."
git -c core.autocrlf=false tag -f v1.0.1
git -c core.autocrlf=false push origin HEAD
git -c core.autocrlf=false push -f origin v1.0.1
```

`core.autocrlf=false` 必须加，否则 Windows 下会把换行整体改写，diff 变成全文件重写。

推送前扫一遍是否带上了敏感文件：

```bash
git status --short | grep -E "\.dev\.vars|\.env$"
```

`.dev.vars`、`.env` 已在 `.gitignore` 中，不要用 `-f` 强推。

## 上线后抽查

- 未登录访问 `/api/admin/<resource>` 应返回 401。
- 公开页（相册、文章）确认草稿与私密内容未泄露。
- 评论、友链提交走 Turnstile，站点 key 缺失时整条链路失败。
