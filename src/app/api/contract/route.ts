import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/auth0";
import {
  signContract,
  getContract,
  getAuditLog,
  clearAuditLog,
} from "@/lib/contracts/store";
import { ContractRule } from "@/lib/contracts/types";

export async function GET() {
  const user = await getUser();
  if (!user?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const contract = getContract(user.sub);
  const audit = getAuditLog(user.sub);

  return NextResponse.json({ contract, audit });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { rules } = (await req.json()) as { rules: ContractRule[] };

  if (!rules || !Array.isArray(rules)) {
    return NextResponse.json({ error: "Invalid rules" }, { status: 400 });
  }

  const contract = await signContract(user.sub, rules);
  clearAuditLog(user.sub);

  return NextResponse.json({ contract });
}
