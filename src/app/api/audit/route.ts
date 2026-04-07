import { NextResponse } from "next/server";

import { getUser } from "@/lib/auth0";
import { getAuditLog } from "@/lib/contracts/store";

export async function GET() {
  const user = await getUser();
  if (!user?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const audit = getAuditLog(user.sub);
  return NextResponse.json({ audit });
}
