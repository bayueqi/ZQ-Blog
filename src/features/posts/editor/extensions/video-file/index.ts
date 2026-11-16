import { ReactNodeViewRenderer } from "@tiptap/react";
import { schemaVideoFile } from "@/features/posts/editor/schema";
import { VideoFileView } from "./video-file-view";

/** A video picked from the media library, or uploaded for the post. */
export interface PickedVideo {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
}

/**
 * A video uploaded to the media library, shown and played in the document.
 * It is placed by the image picker, which takes either kind of file.
 */
export const VideoFileBlock = schemaVideoFile.extend({
  selectable: true,

  addNodeView() {
    return ReactNodeViewRenderer(VideoFileView, {
      // 点播放器交给浏览器，点周围那圈留白才选中这个块。
      stopEvent: ({ event }) =>
        event.target instanceof Element &&
        event.target.closest("video") !== null,
    });
  },
});
