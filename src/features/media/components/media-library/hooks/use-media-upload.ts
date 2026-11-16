import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_MEDIA_TYPES,
  MAX_FILE_SIZE,
} from "@/features/media/media.schema";
import { orpc, orpcClient } from "@/lib/orpc";
import { m } from "@/paraglide/messages";

export function useMediaUpload() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => orpcClient.media.upload({ image: file }),
  });

  /** `imagesOnly` 给封面、头像这类只能是图片的场合。 */
  const uploadFiles = async (
    files: Array<File>,
    options?: { imagesOnly?: boolean },
  ) => {
    const accepted = options?.imagesOnly
      ? ACCEPTED_IMAGE_TYPES
      : ACCEPTED_MEDIA_TYPES;
    const images = files.filter((file) => accepted.includes(file.type));
    if (images.length === 0) {
      toast.error(m.media_validation_file_invalid_type());
      return;
    }

    setProgress({ current: 0, total: images.length });
    try {
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        setProgress({ current: i + 1, total: images.length });
        if (file.size > MAX_FILE_SIZE) {
          toast.error(m.media_validation_file_too_large());
          continue;
        }
        try {
          await uploadMutation.mutateAsync(file);
          toast.success(m.media_upload_success());
        } catch {
          toast.error(m.media_upload_fail({ name: file.name }));
        }
      }
      await queryClient.invalidateQueries({ queryKey: orpc.media.key() });
    } finally {
      setProgress(null);
    }
  };

  return {
    uploadFiles,
    progress,
    isUploading: progress != null,
  };
}
