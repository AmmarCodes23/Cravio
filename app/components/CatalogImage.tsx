"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { PLACEHOLDER_IMAGE, sniffImageContentType } from "@/lib/product-image";

const FALLBACK = PLACEHOLDER_IMAGE;

function isRemote(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

type CatalogImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
};

export default function CatalogImage({
  src,
  alt,
  onError,
  unoptimized,
  className,
  fill,
  sizes,
  priority,
  ...rest
}: CatalogImageProps) {
  const incoming = src?.trim() ? src.trim() : FALLBACK;
  const [current, setCurrent] = useState(incoming);
  const blobTriedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    blobTriedRef.current = false;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setCurrent(incoming);
    return () => {
      mountedRef.current = false;
    };
  }, [incoming]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (!mountedRef.current) return;
    if (current === FALLBACK) return;

    // CDN objects are often application/octet-stream. <img> may fail; refetch
    // and re-tag as a real image/* blob so Safari/Chrome will paint it.
    if (isRemote(incoming) && !blobTriedRef.current) {
      blobTriedRef.current = true;
      void (async () => {
        try {
          const res = await fetch(incoming);
          if (!res.ok) throw new Error("fetch failed");
          const bytes = new Uint8Array(await res.arrayBuffer());
          const type = sniffImageContentType(bytes);
          if (!type || type === "image/heic") throw new Error("unsupported");
          const blobUrl = URL.createObjectURL(new Blob([bytes], { type }));
          blobUrlRef.current = blobUrl;
          if (mountedRef.current) setCurrent(blobUrl);
        } catch {
          if (mountedRef.current) {
            setCurrent(FALLBACK);
            onError?.(event);
          }
        }
      })();
      return;
    }

    setCurrent(FALLBACK);
    onError?.(event);
  };

  const useNativeImg =
    isRemote(current) || current.startsWith("blob:") || Boolean(unoptimized);

  if (useNativeImg) {
    const fillClass = fill ? "absolute inset-0 h-full w-full" : "";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={current}
        alt={alt}
        sizes={sizes}
        className={[fillClass, className].filter(Boolean).join(" ")}
        onError={handleError}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    );
  }

  return (
    <Image
      {...rest}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      src={current}
      alt={alt}
      onError={handleError}
    />
  );
}
