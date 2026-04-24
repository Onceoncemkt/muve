import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAuthDisabled } from "@/lib/supabase/runtime";

export async function middleware(request: NextRequest) {
  if (isAuthDisabled) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
