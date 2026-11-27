import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Nova AI Doc 已停止提供：全站回應 410，保留程式碼與資料以便日後還原。 */
const SERVICE_RETIRED = true;

const RETIRED_HTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex,nofollow" />
  <title>服務已停止提供｜拓新雲端 NovaOS</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:4rem 1rem;color:#334155;">
  <h1 style="font-size:1.5rem;">此服務已停止提供</h1>
  <p>感謝您的支持。如有問題，請前往 <a href="https://paycheck.com.de">拓新雲端 NovaOS 主站</a>。</p>
</body>
</html>`;

function retiredResponse() {
  return new NextResponse(RETIRED_HTML, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * 刷新登入 Session，並保護 /dashboard 路徑
 */
export async function middleware(request: NextRequest) {
  if (
    SERVICE_RETIRED &&
    request.nextUrl.pathname !== "/api/internal/novashield-analyze"
  ) {
    return retiredResponse();
  }
  if (request.nextUrl.pathname === "/api/internal/novashield-analyze") {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 尚未設定環境變數時，不阻斷開發（API 仍會回傳錯誤）
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  if (isDashboard && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
