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
const IP_API_TIMEOUT_MS = 4000;

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

// ============ IP 归属地查询(ip-api.com) ============

export interface IpInfo {
  /** 中文国家,如「中国」 */
  country: string;
  /** 中文省/州,如「广东省」 */
  region: string;
  /** 中文城市,如「深圳市」 */
  city: string;
  /** 运营商,如「中国电信」 */
  isp: string;
  /** ASN 编号 + 名称,如「AS4134 CHINANET-BACKBONE」 */
  as: string;
  /** 纬度 */
  lat: number | null;
  /** 经度 */
  lon: number | null;
  /** 时区,如「Asia/Shanghai」 */
  timezone: string;
  /** 是否代理/VPN(布尔字符串,ip-api 返回 "true"/"false") */
  proxy: boolean;
  /** 原始查询的 IP */
  query: string;
}

/**
 * 通过 ip-api.com 查询 IP 的归属地信息(中文)。
 *
 * - 免费额度:45 次/分钟(无每日上限,适合博客评论场景)
 * - 返回中文国家/省/市,带运营商、ASN、经纬度
 * - 失败或超时返回 null(4 秒超时,失败容忍)
 *
 * @param ip IPv4 或 IPv6
 * @returns IpInfo 或 null
 */
export async function queryIpInfo(ip: string): Promise<IpInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_API_TIMEOUT_MS);

    // lang=zh-CN 返回中文;fields 显式指定要返回的字段
    const resp = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,message,country,regionName,city,isp,as,lat,lon,timezone,proxy,query`,
      { signal: controller.signal },
    );

    clearTimeout(timer);

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      status: string;
      message?: string;
      country?: string;
      regionName?: string;
      city?: string;
      isp?: string;
      as?: string;
      lat?: number;
      lon?: number;
      timezone?: string;
      proxy?: boolean | string;
      query?: string;
    };

    if (data.status !== "success") return null;

    return {
      country: data.country ?? "",
      region: data.regionName ?? "",
      city: data.city ?? "",
      isp: data.isp ?? "",
      as: data.as ?? "",
      lat: typeof data.lat === "number" ? data.lat : null,
      lon: typeof data.lon === "number" ? data.lon : null,
      timezone: data.timezone ?? "",
      proxy:
        typeof data.proxy === "boolean"
          ? data.proxy
          : data.proxy === "true",
      query: data.query ?? ip,
    };
  } catch {
    return null;
  }
}

/**
 * 将 IpInfo 拼成可读的归属地字符串(前台展示用)。
 * 例如:「中国 / 广东省 / 深圳市」
 */
export function formatIpRegion(info: IpInfo): string {
  const parts = [info.country, info.region, info.city].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length > 0 ? parts.join(" / ") : "未知";
}

/**
 * 将 IpInfo 拼成后台展示用的完整信息字符串(含运营商/ASN/经纬度)。
 * 例如:「中国 / 广东省 / 深圳市 | 中国电信 | AS4134 | 22.54,114.06」
 */
export function formatIpAdminInfo(info: IpInfo): string {
  const region = formatIpRegion(info);
  const extras: string[] = [];
  if (info.isp) extras.push(info.isp);
  if (info.as) extras.push(info.as);
  if (info.lat !== null && info.lon !== null) {
    extras.push(`${info.lat},${info.lon}`);
  }
  return extras.length > 0 ? `${region} | ${extras.join(" | ")}` : region;
}
