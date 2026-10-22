import { useEffect, type RefObject } from "react";
import { m } from "@/paraglide/messages";

/** Links PhotoSwipe opens; ZoomableImage renders them. */
export const ZOOMABLE_IMAGE_SELECTOR = "a[data-zoomable-image]";

/**
 * Opens the zoomable images inside `galleryRef` in PhotoSwipe as one gallery:
 * fit to the screen, click or wheel to the original pixels, swipe or arrow
 * keys between images. The library loads after mount and its core on the
 * first click, so pages pay nothing until a reader opens an image.
 * `galleryKey` rebinds it when the gallery element may have been replaced,
 * such as after navigating to another post.
 */
export function usePhotoSwipeGallery(
  galleryRef: RefObject<HTMLElement | null>,
  galleryKey: unknown,
) {
  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    let lightbox: { destroy: () => void } | null = null;
    let cancelled = false;

    void import("photoswipe/lightbox").then(
      ({ default: PhotoSwipeLightbox }) => {
        if (cancelled) return;
        const instance = new PhotoSwipeLightbox({
          gallery,
          children: ZOOMABLE_IMAGE_SELECTOR,
          pswpModule: () => import("./photo-swipe-module"),
          showHideAnimationType: "zoom",
          bgOpacity: 0.92,
          wheelToZoom: true,
          // A click on the image goes to its original pixels.
          secondaryZoomLevel: 1,
          maxZoomLevel: 2,
          closeTitle: m.common_close(),
          zoomTitle: m.post_image_zoom(),
          arrowPrevTitle: m.post_image_prev(),
          arrowNextTitle: m.post_image_next(),
          errorMsg: m.post_image_error(),
        });

        // Images saved without a size fall back to the inline image's.
        instance.addFilter("itemData", (itemData) => {
          if (itemData.width && itemData.height) return itemData;
          const img = itemData.element?.querySelector("img");
          if (img?.naturalWidth) {
            itemData.width = img.naturalWidth;
            itemData.height = img.naturalHeight;
          }
          return itemData;
        });

        instance.on("uiRegister", () => {
          instance.pswp?.ui?.registerElement({
            name: "post-caption",
            className: "pswp__post-caption",
            appendTo: "root",
            onInit: (element, pswp) => {
              const update = () => {
                element.textContent =
                  pswp.currSlide?.data.element?.dataset.caption ?? "";
              };
              pswp.on("change", update);
              update();
            },
          });
        });

        instance.init();
        lightbox = instance;
      },
    );

    return () => {
      cancelled = true;
      lightbox?.destroy();
    };
  }, [galleryRef, galleryKey]);
}
