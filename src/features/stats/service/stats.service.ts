import * as StatsRepo from "@/features/stats/data/stats.data";
import type { SiteStats } from "@/features/stats/stats.schema";

const toDate = (value: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function getSiteStats(context: DbContext): Promise<SiteStats> {
  const { db } = context;

  const [posts, moments, gallery, friendLinks] = await Promise.all([
    StatsRepo.countPublishedPosts(db),
    StatsRepo.countPublishedMoments(db),
    StatsRepo.countPublicGallery(db),
    StatsRepo.countApprovedFriendLinks(db),
  ]);

  return {
    posts: posts.total,
    latestPostAt: toDate(posts.latest),
    moments: moments.total,
    latestMomentAt: toDate(moments.latest),
    galleries: gallery.galleries,
    photos: gallery.photos,
    friendLinks: friendLinks.total,
    latestFriendLinkAt: toDate(friendLinks.latest),
  };
}
