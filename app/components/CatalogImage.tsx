"use client";

import type { ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/lib/product-image";

const FALLBACK = PLACEHOLDER_IMAGE;

function isRemote(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

type CatalogImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
};

/**
 * Catalog photos are always a plain <img>: they are already CDN-hosted (R2) and
 * routing them (or the local dummy) through next/image billed one Vercel image
 * transformation per size variant for every product.
 */
export default function CatalogImage({
  src,
  alt,
  onError,
  className,
  fill,
  sizes,
  priority,
  width,
  height,
  draggable,
}: CatalogImageProps) {
  const incoming = src?.trim() ? src.trim() : FALLBACK;
  const [current, setCurrent] = useState(incoming);

  useEffect(() => {
    setCurrent(incoming);
  }, [incoming]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    // Remote CDN objects often have no CORS and an octet-stream MIME.
    // A fetch() remint fails even when <img> can paint the bytes, so we
    // keep the real URL. Dummy only for missing/local paths.
    if (current === FALLBACK || isRemote(incoming)) {
      onError?.(event);
      return;
    }
    setCurrent(FALLBACK);
    onError?.(event);
  };

  const fillClass = fill ? "absolute inset-0 h-full w-full" : "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      sizes={sizes}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      draggable={draggable}
      className={[fillClass, className].filter(Boolean).join(" ")}
      onError={handleError}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      {...(priority ? { fetchPriority: "high" as const } : {})}
    />
  );
}
