/**
 * 评论归属地展示工具(纯函数,客户端可安全导入)。
 *
 * 注意:此文件不得 import 任何服务端依赖(serverEnv / getRequestHeader / doh 等),
 * 否则会被打入客户端 bundle,触发 SSR 模块导入 node:stream 等问题。
 */

/**
 * 从 region 字符串中提取前台可展示的归属地部分。
 * 现在 region 直接存储「中国 / 山东省 / 济南市」这种简洁格式,
 * 不再拼运营商/ASN/经纬度,所以直接原样返回即可。
 * 保留此函数是为了兼容旧评论(历史 region 可能用 | 拼了 extras)。
 */
export function getPublicRegion(
  region: string | null | undefined,
): string | null {
  if (!region) return null;
  // 兼容旧格式:「中国 / 山东省 / 济南市 | 中国电信 | ...」
  // 新格式:「中国 / 山东省 / 济南市」(没有 |)
  const idx = region.indexOf("|");
  return idx > 0 ? region.slice(0, idx).trim() : region;
}
