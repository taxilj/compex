"use client";

import { useState } from "react";

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  /** Intrinsic size hints (CSS still controls the rendered size); lets the browser reserve space. */
  width?: number;
  height?: number;
  /** Above-the-fold image: load immediately with high priority instead of lazily. */
  eager?: boolean;
}

/**
 * Renders an <img>, swapping to `fallback` when there is no src or the image
 * fails to load (e.g. a supplier image CDN outage). The failed URL is never
 * retried, so a dead link can't loop.
 */
export function ImageWithFallback({ src, alt, fallback, className, width, height, eager }: ImageWithFallbackProps) {
  // Keying by src makes React remount this subtree on a new URL, which
  // resets `failed` for free — no effect needed to sync state to a prop.
  return (
    <ImageWithFallbackInner key={src ?? "none"} src={src} alt={alt} fallback={fallback} className={className} width={width} height={height} eager={eager} />
  );
}

function ImageWithFallbackInner({ src, alt, fallback, className, width, height, eager }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className="flex items-center justify-center w-full h-full">
        {fallback}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
