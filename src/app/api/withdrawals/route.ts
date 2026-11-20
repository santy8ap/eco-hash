import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";
import { createBtcWithdrawal } from "@/lib/withdrawals";
import { TOO_MANY_WITHDRAWALS, withdrawalLimiter } from "@/lib/security/limits";

const Body = z.object({
  amountSats: z.number().int().positive(),
  address: z.string().trim().min(1).max(120),
});

/** Solicita un retiro de sats a una dirección Bitcoin. Queda en revisión hasta que el admin lo envía. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await withdrawalLimiter.hit(user.id))) return jsonError(TOO_MANY_WITHDRAWALS, 429);
    return Response.json({ withdrawal: await createBtcWithdrawal({ userId: user.id, amountSats: b.amountSats, address: b.address }) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
