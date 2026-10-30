#requires -Version 5.1
<#
    构建并部署 ZQ-Blog 到 Cloudflare Workers。

    凭据与资源 ID 一律从进程环境变量读取，脚本内不含任何真实值。
    运行前在同一个终端里设好下列变量（或写进本机用户环境变量）：

        CLOUDFLARE_API_TOKEN
        CLOUDFLARE_ACCOUNT_ID
        WORKER_NAME
        DOMAIN
        D1_DATABASE_ID
        KV_NAMESPACE_ID
        BUCKET_NAME
        QUEUE_NAME
        VITE_TURNSTILE_SITE_KEY

    用法：
        powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
        powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -SkipBuild
#>
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$required = @(
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "WORKER_NAME",
    "DOMAIN",
    "D1_DATABASE_ID",
    "KV_NAMESPACE_ID",
    "BUCKET_NAME",
    "QUEUE_NAME",
    "VITE_TURNSTILE_SITE_KEY"
)

$missing = @($required | Where-Object {
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
})

if ($missing.Count -gt 0) {
    Write-Host "缺少环境变量：" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

$outputDir = Join-Path $repoRoot ".cloudflare\output"

if (-not $SkipBuild) {
    if (Test-Path $outputDir) {
        [System.IO.Directory]::Delete($outputDir, $true)
    }

    Write-Host "构建中…" -ForegroundColor Cyan
    bun run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "构建失败，中止部署。" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

if (-not (Test-Path $outputDir)) {
    Write-Host "找不到 .cloudflare\output，请先构建。" -ForegroundColor Red
    exit 1
}

Write-Host "部署中…" -ForegroundColor Cyan
bunx cf deploy --prebuilt
if ($LASTEXITCODE -ne 0) {
    Write-Host "部署失败。" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "完成：$env:WORKER_NAME → $env:DOMAIN" -ForegroundColor Green
