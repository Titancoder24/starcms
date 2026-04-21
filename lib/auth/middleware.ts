import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function adminMiddleware(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    const callbackUrl = encodeURIComponent(req.nextUrl.pathname);
    return NextResponse.redirect(
      new URL(`/signin?callbackUrl=${callbackUrl}`, req.url)
    );
  }
  return NextResponse.next();
}
