/**
 * IP 归属地查询工具(ip-api.com)
 *
 * 用于评论入库时查询作者 IP 的中文归属地(国家/省/市)。
 * 免费额度 45 次/分钟,失败/超时返回 null,不影响评论创建。
 */

const IP_API_TIMEOUT_MS = 4000;

export interface IpInfo {
  /** 中文国家,如「中国」 */
  country: string;
  /** 中文省/州,如「广东省」 */
  region: string;
  /** 中文城市,如「深圳市」 */
  city: string;
}

/**
 * 通过 ip-api.com 查询 IP 的中文归属地(国家/省/市)。
 *
 * @param ip IPv4 或 IPv6
 * @returns IpInfo 或 null(失败/超时)
 */
export async function queryIpInfo(ip: string): Promise<IpInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_API_TIMEOUT_MS);

    // lang=zh-CN 返回中文;只查归属地三个字段,省流量省时间
    const resp = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,message,country,regionName,city`,
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
    };

    if (data.status !== "success") return null;

    return {
      country: data.country ?? "",
      region: data.regionName ?? "",
      city: data.city ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * 将 IpInfo 拼成可读的归属地字符串。
 * 例如:「中国 / 广东省 / 深圳市」
 */
export function formatRegion(info: IpInfo): string {
  const parts = [info.country, info.region, info.city].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length > 0 ? parts.join(" / ") : "未知";
}
