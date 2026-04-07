import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth0";
import { grantApproval } from "@/lib/contracts/store";

export async function POST(req: NextRequest) {
  const user = await getUser();
  const userId = user?.sub ?? "anonymous";
  const { toolName } = await req.json();

  if (!toolName) {
    return NextResponse.json({ error: "toolName required" }, { status: 400 });
  }

  grantApproval(userId, toolName);
  return NextResponse.json({ approved: true, toolName });
}
