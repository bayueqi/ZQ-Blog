/**
 * IP 归属地查询工具(ip-api.com)
 *
 * 用于评论入库时查询作者 IP 的归属地信息(中文),含运营商/ASN/经纬度。
 * 免费额度 45 次/分钟,适合博客评论场景。失败/超时返回 null,不影响评论创建。
 */

const IP_API_TIMEOUT_MS = 4000;

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
  /** 是否代理/VPN */
  proxy: boolean;
  /** 原始查询的 IP */
  query: string;
}

/**
 * 通过 ip-api.com 查询 IP 的归属地信息(中文)。
 *
 * @param ip IPv4 或 IPv6
 * @returns IpInfo 或 null(失败/超时)
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
