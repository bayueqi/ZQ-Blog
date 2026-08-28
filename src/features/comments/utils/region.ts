/**
 * 评论归属地展示工具(纯函数,客户端可安全导入)。
 *
 * 注意:此文件不得 import 任何服务端依赖(serverEnv / getRequestHeader / doh 等),
 * 否则会被打入客户端 bundle,触发 SSR 模块导入 node:stream 等问题。
 */

/**
 * 从完整 region 字符串中提取前台可展示的归属地部分(「|」之前)。
 * 例如:「中国 / 广东省 / 深圳市 | 中国电信 | AS4134」→「中国 / 广东省 / 深圳市」
 * 如果没有「|」(只有归属地),原样返回。
 */
export function getPublicRegion(
  region: string | null | undefined,
): string | null {
  if (!region) return null;
  const idx = region.indexOf("|");
  return idx > 0 ? region.slice(0, idx).trim() : region;
}
