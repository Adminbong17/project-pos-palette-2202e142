import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { installChunkRecovery, isChunkLoadError, recoverFromChunkError } from "../lib/chunk-recovery";
import { Toaster } from "@/components/ui/sonner";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { SiteFooter } from "@/components/site-footer";

installChunkRecovery();



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(err);
  const router = useRouter();
  const stale = isChunkLoadError(error);
  useEffect(() => {
    if (recoverFromChunkError(error)) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stale ? "A new version was just released. Reloading…" : error.message}
        </p>
        <button
          onClick={() => {
            if (stale) { window.location.reload(); return; }
            router.invalidate(); reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Try again</button>
      </div>
    </div>
  );
}


// Newer @tanstack/react-router types expect errorComponent as a lazy component.
const LazyErrorComponent = lazy(async () => ({ default: ErrorComponent }));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "QweekPOS — Point of Sale" },
      { name: "description", content: "Modern point-of-sale and inventory management." },
      { property: "og:title", content: "QweekPOS — Point of Sale" },
      { name: "twitter:title", content: "QweekPOS — Point of Sale" },
      { property: "og:description", content: "Modern point-of-sale and inventory management." },
      { name: "twitter:description", content: "Modern point-of-sale and inventory management." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/29817ec5-e1ad-4d80-880c-d12d70fa2992" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/29817ec5-e1ad-4d80-880c-d12d70fa2992" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: LazyErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionKeepAlive />
      <Outlet />
      <SiteFooter />
      <Toaster />
    </QueryClientProvider>
  );
}

