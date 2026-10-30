# 部署 ZQ-Blog

通过 **GitHub + Cloudflare Workers Builds**，在浏览器里就把整套博客部署起来，并用自己的域名访问。

## 前置条件

- 一个 GitHub 账号。
- 一个 Cloudflare 账号，已绑定付款方式并开通 R2。
- 一个已在 Cloudflare 托管、状态为 **Active（有效）** 的域名。

> 编辑器里的「AI 自动生成摘要」使用 Cloudflare Workers AI。绑定已在 `cloudflare.config.ts` 中声明（`AI: bindings.ai()`），部署时会自动生效，**不需要到控制台手动添加绑定，也不需要 API Key**；模型按实际调用量计费，不用这个功能可以忽略。

下文以 `blog.example.com` 为博客域名、`zq-blog` 为 Worker 名称，操作时替换成自己的值。建议用一个空闲子域名，所有资源都建在托管该域名的 Cloudflare 账号下。

## 开始操作

1. [Fork 仓库](#1-fork-仓库)
2. [准备两份变量清单](#2-准备两份变量清单)
3. [创建 GitHub OAuth App](#3-创建-github-oauth-app)
4. [创建 Cloudflare 资源](#4-创建-cloudflare-资源)
5. [可选：开启图片优化](#5-可选开启图片优化)
6. [创建 Worker 并部署](#6-创建-worker-并部署)
7. [登录博客，成为管理员](#7-登录博客成为管理员)
8. [以后如何更新](#8-以后如何更新)

### 1. Fork 仓库

打开 [bayueqi/ZQ-Blog](https://github.com/bayueqi/ZQ-Blog)，点击右上角 **Fork**，Owner 选自己的账号，勾选 **Copy the main branch only**，点击 **Create fork**。

创建后进入 `github.com/你的用户名/ZQ-Blog`，后面都用这份仓库部署。仓库名不需要和 `zq-blog` 一致，Worker 名称在下一步单独填。

### 2. 准备两份变量清单

在仓库根目录打开下面两个文件，点 **Raw** 复制内容，分别存成电脑上的两个文本文件，边做边补：

| 模板 | 建议保存为 | 用途 | 最后填到哪 |
| --- | --- | --- | --- |
| [.env.example](../.env.example) | `.env` | **构建时变量**：用哪个域名、哪些资源 | Cloudflare 的构建变量 |
| [.dev.vars.example](../.dev.vars.example) | `.dev.vars` | **运行时变量**：认证、邮件等 | Worker 的变量和机密 |

#### 构建时必填项

| 变量 | 示例 | 作用 |
| --- | --- | --- |
| `WORKER_NAME` | `zq-blog` | Worker 名称，第 6 步的 Project name 必须与它一致 |
| `DOMAIN` | `blog.example.com` | 博客的纯域名，不带协议 |
| `D1_DATABASE_ID` | 第 4 步复制的 UUID | 找到文章、用户、访客统计等数据的数据库 |
| `BUCKET_NAME` | `zq-blog-media` | 找到存放图片等文件的 R2 存储桶 |
| `QUEUE_NAME` | `zq-blog-queue` | 找到处理通知等异步任务的队列 |
| `KV_NAMESPACE_ID` | 第 4 步复制的 Namespace ID | 找到博客用的缓存空间 |

先填好 `WORKER_NAME` 和 `DOMAIN`，其余四项在第 4 步补齐。模板里的可选项和本地工具变量可以跳过。

| 可选变量 | 说明 |
| --- | --- |
| `ROUTE` | 设为 `1` 改用 Workers Routes 绑定（适合子域名上已有 DNS 记录的情况），不设则用 Custom Domain 自动加记录 |
| `ZONE_NAME` | 仅 `ROUTE=1` 时需要，默认从 `DOMAIN` 推导 |
| `VITE_TURNSTILE_SITE_KEY` | 前端 Turnstile 站点 key，与运行时 `TURNSTILE_SECRET_KEY` 成对使用 |

#### 运行时必填项

| 变量 | 填什么 | 作用 |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | 自己生成的一串随机密钥，至少 32 个字符 | 保护登录会话与私密内容解锁，生成后妥善保存 |
| `BETTER_AUTH_URL` | `https://blog.example.com` | 博客完整地址，用于登录与回调 |
| `DOMAIN` | `blog.example.com` | 与构建时保持一致 |
| `GITHUB_CLIENT_ID` | 第 3 步的 Client ID | 标识你的 GitHub 登录应用 |
| `GITHUB_CLIENT_SECRET` | 第 3 步的 Client Secret | 上面这个应用的密钥 |

模板里的本地开发值要改成线上值：`BETTER_AUTH_URL` 改成自己的 HTTPS 地址，`ENVIRONMENT` 改成 `prod`。

`BETTER_AUTH_SECRET` 用密码管理器生成，或者打开任意 HTTPS 页面的开发者工具 Console，执行下面这段，复制结果（不含两边引号）：

```js
Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
  n.toString(16).padStart(2, "0"),
).join("");
```

### 3. 创建 GitHub OAuth App

这个应用让管理员和读者用 GitHub 登录。

打开 **Settings → Developer settings → OAuth Apps → New OAuth App**，或直接打开 [创建页面](https://github.com/settings/applications/new)：

| 表单项 | 填写内容 |
| --- | --- |
| Application name | 博客名称，例如 `ZQ-Blog` |
| Homepage URL | `https://blog.example.com` |
| Application description | 留空 |
| Authorization callback URL | `https://blog.example.com/api/auth/callback/github` |

域名换成自己的，末尾的 **`/api/auth/callback/github`** 不要改。

点 **Register application** 后：

1. 复制 **Client ID**，填入 `GITHUB_CLIENT_ID`。
2. 点 **Generate a new client secret**，按提示确认身份。
3. 立刻复制 **Client secret** 填入 `GITHUB_CLIENT_SECRET`，离开页面就看不到了。

### 4. 创建 Cloudflare 资源

打开 [Cloudflare 控制台](https://dash.cloudflare.com/)，选托管域名的账号，下面四种资源各建一个，名称随意：

| 资源 | 菜单入口 | 示例名称 | 记下什么 |
| --- | --- | --- | --- |
| D1 数据库 | Storage & databases → D1 SQLite Database | `zq-blog-db` | **UUID** → `D1_DATABASE_ID` |
| R2 存储桶 | Storage & databases → R2 Object Storage | `zq-blog-media` | **名称** → `BUCKET_NAME` |
| Queue 队列 | Compute → Queues | `zq-blog-queue` | **名称** → `QUEUE_NAME` |
| KV 命名空间 | Storage & databases → Workers KV | `zq-blog-cache` | **ID** → `KV_NAMESPACE_ID` |

- **D1**：点 **Create Database**，填名称，位置保留默认。回到列表复制 **UUID**，也可以在详情里看 **Database ID**。表结构由部署过程自动迁移，不用手动建表。
- **R2**：点 **Create bucket**，Location 保留 **Automatic**，Storage Class 保留 **Standard**。
- **Queue**：点 **Create Queue**，填名称即可。
- **KV**：点 **Create Instance**（部分界面写作 Create namespace），填名称，回到列表复制 **ID**。

### 5. 可选：开启图片优化

开启 Cloudflare **Image Transformations** 后，博客会按需缩放压缩图片。不开也能用，只是按原图输出。

在账号侧栏打开 **Images & Stream → Transformations**（部分界面在 Images 下），找到博客所属的根域名，例如 `example.com`，为该域名启用转换；Sources 选 **This zone only**，保存。列表显示 **Enabled**，或设置页出现 **Disable for zone**，就是开了。额度与价格见 [Cloudflare Images 定价](https://developers.cloudflare.com/images/pricing/)。

### 6. 创建 Worker 并部署

打开 **Compute → Workers & Pages → Create application → Continue with GitHub**，首次连接按提示授权，然后选中自己的仓库点 **Next**。

**Set up your application** 按下面填：

| 设置项 | 填写内容 |
| --- | --- |
| Project name / Worker name | 与 `WORKER_NAME` 一致，例如 `zq-blog` |
| Build command | `bun run build` |
| Deploy command | `bun run deploy` |
| Path / Root directory | `/` |
| Builds for non-production branches | 首次部署建议取消勾选 |

展开 **Advanced settings**，把构建清单里那六个变量逐个加进去（Variable name 填等号左边，Variable value 填右边）。

也可以顺手加 `BUN_VERSION=1.3.5` 固定构建用的 Bun 版本；Node 版本由仓库根目录的 `.node-version` 决定，不用管。

确认生产分支是自己的 `main`。部分界面在创建时用仓库默认分支，创建后可在 **Settings → Builds → Branch control** 里核对，以后自动部署监听的就是这个分支。

点 **Deploy**，等构建和部署跑完。`bun run deploy` 会先对线上 D1 执行 `cf d1 migrations apply`（建表，包括访客统计表 `visit_stats`），再发布 Worker，并通过 **Custom Domain** 绑定博客域名。

#### 添加运行时变量

首次部署成功后，打开该 Worker 的 **Settings → Runtime variables and secrets**，点 **Add variable** 添加上面那五个运行时变量。可以逐项填，也可以把 `KEY=value` 整段粘进 **Key** 输入框批量导入。

- **全部勾选 Secret**，包括 `BETTER_AUTH_URL`、`DOMAIN`、`GITHUB_CLIENT_ID`、`ENVIRONMENT`。`cf deploy` 会保留机密，但会清掉没写进配置文件的纯文本变量，清掉后博客会报 `Invalid environment variables`。
- `ENVIRONMENT` 填 `prod`。

点 **Add variable and deploy**，等生效。最后在 Worker 的 **Domains**（部分界面为 Settings → Domains & Routes）确认域名已绑定，DNS 与证书生效后即可访问。

### 7. 登录博客，成为管理员

打开自己的域名，点右上角登录，选 **GitHub 登录** 完成授权，第一次登录会自动建用户。**数据库里的第一个用户自动成为管理员**，所以先把自己登进去，再把地址发给别人。

登录后点头像应当能看到 **管理后台**，也可以直接访问 `/admin`。进去先改站点名称、介绍和外观，上传一张图，发第一篇文章。

### 8. 以后如何更新

改完代码推送到 Cloudflare 监听的生产分支（默认 `main`）就会自动构建部署，数据库迁移也会一起执行，已有的资源和运行时机密都会保留：

```bash
git add -A
git commit -m "更新内容"
git push
```

如果这份仓库是从别人那里 Fork 来的，也可以在 GitHub 上点 **Sync fork → Update branch** 同步上游，同步产生的提交同样会触发部署。

## 可选配置

先把基本部署跑通，再按需加。变量的完整说明以 [.env.example](../.env.example) 和 [.dev.vars.example](../.dev.vars.example) 为准。

| 功能 | 构建时变量 | 运行时变量 | 说明 |
| --- | --- | --- | --- |
| AI 生成摘要 | 无 | 无 | 编辑器的摘要栏提供「自动生成」，调用 Workers AI 模型 `@cf/zai-org/glm-4.7-flash`。绑定已写在 `cloudflare.config.ts` 的 `AI` 中，部署后即可使用，按调用量计费，详见 [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Turnstile 人机验证 | `VITE_TURNSTILE_SITE_KEY` | `TURNSTILE_SECRET_KEY`（Secret） | 在 Cloudflare 创建站点并加入博客域名，两个 key 成对使用 |
| 更新检查走 GitHub API | 无 | `GITHUB_TOKEN`（Secret） | 不配也能检查更新（读发布页跳转）；配了优先走 API，更稳定，API 失败仍会退回发布页。按模板链接建一个只读公共仓库的 fine-grained token |

修改**构建时变量**后要重新触发一次构建才会进产物；修改**运行时变量**保存并部署即可生效。

## 常见问题

### 构建失败，提示缺少变量或找不到资源

先看构建日志里缺的是哪一项，再查 **Settings → Builds** 的变量：

- 六个构建必填项是否齐全，名字有没有拼错，值前后有没有混进空格。
- D1 和 KV 填的是完整 **ID**，R2 和 Queue 填的是**名称**。
- Worker 与资源是否在同一个 Cloudflare 账号下，`WORKER_NAME` 是否和应用名一致。
- Build command 是否为 `bun run build`，Deploy command 是否为 `bun run deploy`。

日志提示权限不足时，检查 Builds 用的 Cloudflare API token 有没有部署 Worker、访问存储与队列、配置域名的权限。说明见 [Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。

### 部署成功，但域名打不开或页面报错

确认域名已在同一账号托管且为 Active，Worker 的 Domains 里出现该域名，DNS 与证书已生效。子域名如果已有其他记录，先确认冲突来源或换一个。

能访问 Worker 但页面报错，检查五个运行时必填项是否都已保存并部署，再到 **Observability → Logs** 看错误。

### GitHub 登录后提示回调地址错误

三个值里的域名必须完全一致：

```text
博客访问地址：                 https://blog.example.com
BETTER_AUTH_URL：             https://blog.example.com
GitHub OAuth Redirect URI：   https://blog.example.com/api/auth/callback/github
```

再确认 Client ID 与 Client Secret 来自同一个 OAuth App，运行时 `DOMAIN` 是纯域名。

### 登录了，但没有管理员权限

管理员是数据库里的**第一个用户**。如果用的是已有数据的数据库，请用原来的管理员账号登录。

### 点「自动生成」摘要报错

摘要生成走 Cloudflare Workers AI，不需要 API Key，但需要 Worker 里存在 `AI` 绑定：

- 线上：确认部署来自包含 `AI` 绑定的版本，在 Worker 的 **Settings → Bindings** 里能看到 `AI`；再到 **Observability → Logs** 查看具体错误。
- 本地：Workers AI 仍会调用你 Cloudflare 账号上的模型，需要先完成 Cloudflare 登录授权。
- 额度、计费或模型可用性见控制台的 **Workers AI** 页面与 [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)。

### 仪表盘的「访客构成」一直是 0

访客统计写在 D1 的 `visit_stats` 表里，表没建好时接口会静默丢弃，面板自然是 0：

- 线上：确认最近一次部署成功执行了 `cf d1 migrations apply`（部署日志末尾能看到迁移记录）。
- 本地：先跑一次 `bun db:migrate:local`。

统计从部署之后开始累计，之前的访问不会补回来。爬上来的爬虫、命令行请求和空 UA 会被直接丢弃，不计入。

### 图片能显示，但没有优化效果

确认域名的 Transformations 已启用、Sources 允许该域名及其子域名、额度未用完。本地环境、GIF、原图请求不会转换，转换失败也会回退原图。

---

[返回 README](../README.md)
