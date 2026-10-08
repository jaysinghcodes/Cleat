import { NextResponse, type NextRequest } from "next/server";

const LOCAL_CLIENTS = ["http://localhost:8081", "http://127.0.0.1:8081"];

function allowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const configured = process.env.NEXT_PUBLIC_CLIENT_APP_URL?.trim().replace(/\/$/, "");
  const allowed = new Set(LOCAL_CLIENTS);
  if (configured) allowed.add(configured);
  return allowed.has(origin) ? origin : null;
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

export function middleware(request: NextRequest) {
  const origin = allowedOrigin(request);
  if (!origin) return NextResponse.next();
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }
  const response = NextResponse.next();
  corsHeaders(origin).forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
