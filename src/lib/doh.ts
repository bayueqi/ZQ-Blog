/**
 * DoH (DNS over HTTPS) 工具函数
 *
 * 主要用于评论入库时反查 IP 的 PTR 记录,识别评论者是否来自机房/代理。
 * 通过 GET 方式调用 DoH 服务器(RFC 8481),接收 JSON 响应(RFC 8484 的 JSON 变种,
 * Cloudflare/Google/自建 dnsproxy 等均支持)。
 *
 * 环境变量 DOH_URL:你的 DoH 端点,如 https://doh.example.com/dns-query
 */

const DOH_TIMEOUT_MS = 3000;

/**
 * 将 IPv4 / IPv6 转为 in-addr.arpa / ip6.arpa 反向查询名称
 */
function toPtrName(ip: string): string | null {
  // IPv4
  const v4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4Match) {
    const [, a, b, c, d] = v4Match;
    return `${d}.${c}.${b}.${a}.in-addr.arpa`;
  }

  // IPv6(简化展开)
  if (ip.includes(":")) {
    try {
      const expanded = expandIPv6(ip);
      const nibbles = expanded.replaceAll(":", "").split("").reverse();
      return `${nibbles.join(".")}.ip6.arpa`;
    } catch {
      return null;
    }
  }

  return null;
}

function expandIPv6(ip: string): string {
  // 处理 :: 简写
  const parts = ip.split("::");
  let head = parts[0] ? parts[0].split(":") : [];
  let tail = parts.length > 1 && parts[1] ? parts[1].split(":") : [];

  const missing = 8 - (head.length + tail.length);
  if (missing < 0) return ip; // 异常,返回原值

  const full = [...head, ...Array(missing).fill("0"), ...tail];
  return full.map((g) => g.padStart(4, "0")).join(":");
}

/**
 * 反查 IP 的 PTR 记录(域名)
 *
 * @param ip IPv4 或 IPv6
 * @param dohUrl DoH 端点(如 https://doh.example.com/dns-query)
 * @returns PTR 域名(如 "example.com.") 找不到返回 null,异常也返回 null
 */
export async function reverseLookup(
  ip: string,
  dohUrl: string,
): Promise<string | null> {
  const ptrName = toPtrName(ip);
  if (!ptrName) return null;

  const url = new URL(dohUrl);
  url.searchParams.set("name", ptrName);
  url.searchParams.set("type", "PTR");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      Answer?: Array<{ name: string; type: number; data: string }>;
    };

    // type 12 = PTR
    const ptrRecord = data.Answer?.find((a) => a.type === 12);
    if (!ptrRecord) return null;

    // 末尾的点去掉
    return ptrRecord.data.replace(/\.$/, "");
  } catch {
    return null;
  }
}
