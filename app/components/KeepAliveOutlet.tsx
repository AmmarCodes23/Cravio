"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const MAX_CACHED_PAGES = 8;

const BYPASS_PREFIXES = [
  "/checkout",
  "/orders",
  "/account",
  "/user-info",
  "/admin",
];

function shouldBypass(pathname: string) {
  return BYPASS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Frozen page pane. Always position:absolute with its own overflow scroll so
 * document/window scroll is never involved — that was causing the back-nav
 * flash (wrong layer briefly visible) and the late scroll jump (Next.js
 * fighting window.scrollY).
 */
function FrozenRoute({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [tree] = useState(() => children);

  return (
    <div
      aria-hidden={!active}
      {...(!active
        ? ({ inert: true } as React.HTMLAttributes<HTMLDivElement>)
        : {})}
      className="keepalive-pane overscroll-y-contain"
      style={{
        gridArea: "stack",
        position: "absolute",
        inset: 0,
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        zIndex: active ? 1 : 0,
        opacity: active ? 1 : 0,
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {tree}
    </div>
  );
}

/**
 * Keeps storefront routes mounted so back-navigation restores React state
 * and each pane's own scrollTop (no window scroll restoration).
 */
export default function KeepAliveOutlet({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const bypass = shouldBypass(pathname);

  // Visible path can update on popstate BEFORE Next.js usePathname catches up.
  // That one-frame lag was flashing the forward page after swipe-back.
  const [visiblePath, setVisiblePath] = useState(pathname);

  const initialChildrenByPathRef = useRef<Map<string, ReactNode>>(new Map());
  const [knownPaths, setKnownPaths] = useState<string[]>(() =>
    bypass ? [] : [pathname]
  );

  if (!bypass && !initialChildrenByPathRef.current.has(pathname)) {
    initialChildrenByPathRef.current.set(pathname, children);
  }

  useLayoutEffect(() => {
    setVisiblePath(pathname);
  }, [pathname]);

  useLayoutEffect(() => {
    const onPopState = () => {
      setVisiblePath(window.location.pathname || "/");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (bypass) return;
    setKnownPaths((prev) => {
      if (prev.includes(pathname)) return prev;
      const next = [...prev, pathname];
      while (next.length > MAX_CACHED_PAGES) {
        const dropped = next.shift();
        if (dropped) initialChildrenByPathRef.current.delete(dropped);
      }
      return next;
    });
  }, [pathname, bypass]);

  // Kill browser/Next window scroll restoration — panes own scroll.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      history.scrollRestoration = prev;
    };
  }, []);

  useEffect(() => {
    if (bypass) return;
    const lockWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", lockWindowScroll, { capture: true });
    return () =>
      window.removeEventListener("scroll", lockWindowScroll, { capture: true });
  }, [bypass]);

  if (bypass) {
    return (
      <div className="h-full min-h-0 overflow-auto overscroll-y-contain">
        {children}
      </div>
    );
  }

  const displayPath = shouldBypass(visiblePath) ? pathname : visiblePath;

  const paths = Array.from(
    new Set([
      ...knownPaths,
      pathname,
      ...(displayPath !== pathname ? [displayPath] : []),
    ])
  );

  return (
    <div
      className="relative h-full min-h-0 w-full min-w-0"
      style={{ display: "grid", gridTemplateAreas: '"stack"' }}
    >
      {paths.map((path) => (
        <FrozenRoute key={path} active={path === displayPath}>
          {initialChildrenByPathRef.current.get(path) ??
            (path === pathname ? children : null)}
        </FrozenRoute>
      ))}
    </div>
  );
}
