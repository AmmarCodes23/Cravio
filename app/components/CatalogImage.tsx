"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

const FALLBACK = "/images/dummyimage.png";

/** Hosts that should never go through `/_next/image` (dead / unreliable origins). */
const NO_OPTIMIZE_HOSTS = ["admin.dealcart.io", "dealcart.io"];

function hostnameOf(src: string) {
  try {
    return new URL(src).hostname;
  } catch {
    return null;
  }
}

function canOptimize(src: string) {
  if (src.startsWith("/")) return true;
  const hostname = hostnameOf(src);
  if (!hostname) return false;
  if (NO_OPTIMIZE_HOSTS.some((dead) => hostname === dead || hostname.endsWith(`.${dead}`))) {
    return false;
  }
  // Cravio CDN serves files as application/octet-stream. Routing them through
  // `/_next/image` is slow and often fails, then retries the original — double work.
  // Let the browser fetch CDN URLs directly.
  if (hostname === "cdn.craviopk.com" || hostname.endsWith(".craviopk.com")) {
    return false;
  }
  return hostname === "lh3.googleusercontent.com";
}

type CatalogImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
};

export default function CatalogImage({
  src,
  alt,
  onError,
  unoptimized,
  ...rest
}: CatalogImageProps) {
  const incoming = src?.trim() ? src.trim() : FALLBACK;
  const [current, setCurrent] = useState(incoming);
  const [skipOptimizer, setSkipOptimizer] = useState(() => !canOptimize(incoming));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setCurrent(incoming);
    setSkipOptimizer(!canOptimize(incoming));
    return () => {
      mountedRef.current = false;
    };
  }, [incoming]);

  const optimize = Boolean(unoptimized) ? false : canOptimize(current) && !skipOptimizer;

  return (
    <Image
      {...rest}
      key={`${current}:${optimize ? "opt" : "raw"}`}
      src={current}
      alt={alt}
      unoptimized={!optimize}
      onError={(event) => {
        // Ignore errors from unmounted / remounted nodes (common in large grids).
        if (!mountedRef.current) return;
        if (current === FALLBACK) return;

        // Optimizer (or a cancelled first load) failed — retry the original file next.
        if (optimize) {
          setSkipOptimizer(true);
          return;
        }

        // Only swap to dummy after a failed direct (unoptimized) load.
        setCurrent(FALLBACK);
        onError?.(event);
      }}
    />
  );
}
