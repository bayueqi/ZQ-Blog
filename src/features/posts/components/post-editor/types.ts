import type { JSONContent } from "@tiptap/react";

export interface PostEditorCover {
  id: number;
  key: string;
  url: string;
  fileName: string;
  width: number | null;
  height: number | null;
}

export interface PostEditorData {
  title: string;
  summary: string;
  slug: string;
  contentJson: JSONContent | null;
  publishedAt: Date | null;
  pinnedAt: Date | null;
  tagIds: Array<number>;
  categoryId: number | null;
  hasPublicSnapshot: boolean;
  serverToday: string;
  coverMediaId: number | null;
  cover: PostEditorCover | null;
  visibility: "public" | "password";
  /** 解锁前连标题、摘要、时间、封面都不给看。 */
  privacyProtected: boolean;
  /** A new password typed in this session; empty keeps the stored one. */
  accessPassword: string;
  hasAccessPassword: boolean;
}

export interface PostEditorProps {
  /** `accessPassword` is not part of the stored post; it starts empty. */
  initialData: Omit<PostEditorData, "accessPassword"> & {
    id: number;
    publicSnapshotContentJson?: JSONContent | null;
  };
  /** The live page's slug, read fresh from the server; null while unpublished. */
  publicSlug: string | null;
  onSave: (data: PostEditorData) => Promise<void>;
}

export type SaveStatus = "SYNCED" | "SAVING" | "PENDING" | "ERROR";
