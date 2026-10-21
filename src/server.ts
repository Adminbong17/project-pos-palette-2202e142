import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { isPatientHost } from "./lib/rx-mode";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function bindRuntimeEnv(env: unknown) {
  if (!env || typeof env !== "object") return;

  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      bindRuntimeEnv(env);
      // Patient portal domain routing (e.g. pt.sheikhpharma.shop):
      // Redirect root "/" or any non-patient non-api routes directly to "/patient"
      const url = new URL(request.url);
      const rawHost =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        url.hostname;
      const host = (rawHost || "").split(":")[0].toLowerCase().trim();

      if (isPatientHost(host)) {
        const p = url.pathname;
        const isStaticOrApi =
          p.startsWith("/_") ||
          p.startsWith("/api") ||
          p.startsWith("/assets") ||
          /\.(png|jpe?g|svg|ico|webp|css|js|json|woff2?|ttf|txt|xml|pdf)$/i.test(p);

        if (!isStaticOrApi && !p.startsWith("/patient")) {
          const dest = new URL("/patient", request.url);
          dest.search = url.search;
          return Response.redirect(dest.toString(), 302);
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
