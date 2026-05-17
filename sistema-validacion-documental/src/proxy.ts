import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, VERIFICATION_VISITOR_COOKIE } from "@/lib/constants";

const SITE_DISABLED = true;

function disabledResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sitio temporalmente desactivado</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f6f8;
        --card: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --accent: #b91c1c;
        --border: #e2e8f0;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: linear-gradient(180deg, #f8fafc 0%, var(--bg) 100%);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
      }
      .card {
        width: min(680px, 100%);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, .08);
        padding: 40px 32px;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(185, 28, 28, .08);
        color: var(--accent);
        font-weight: 700;
        font-size: 14px;
      }
      h1 {
        margin: 18px 0 12px;
        font-size: clamp(30px, 5vw, 40px);
        line-height: 1.05;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="pill">Sitio desactivado</div>
      <h1>Este dominio fue desactivado temporalmente.</h1>
      <p>El acceso se encuentra suspendido por tiempo indefinido. Cuando corresponda volver a habilitarlo, se reactivará manualmente.</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    },
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SITE_DISABLED && !pathname.startsWith("/_next") && pathname !== "/favicon.ico" && pathname !== "/robots.txt" && pathname !== "/sitemap.xml") {
    return disabledResponse();
  }

  if (pathname === "/verificacion/verificacion") {
    const visitorId = request.cookies.get(VERIFICATION_VISITOR_COOKIE)?.value || crypto.randomUUID();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-visitor-id", visitorId);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    if (!request.cookies.get(VERIFICATION_VISITOR_COOKIE)?.value) {
      response.cookies.set(VERIFICATION_VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  }

  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const expectedToken = process.env.ADMIN_SESSION_TOKEN;
  const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!expectedToken || cookieToken !== expectedToken) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js)$).*)"],
};
