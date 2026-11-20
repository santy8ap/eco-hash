import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { getNetworkStats } from "@/lib/network";
import { getRates } from "@/lib/rates";

/** Datos públicos de la red Bitcoin y el precio del BTC, para la página de inicio y el panel. */
export async function GET() {
  try {
    await connection();
    const [network, rates] = await Promise.all([getNetworkStats(), getRates()]);
    return Response.json(
      { network, btc: { ...rates.prices.BTC, source: rates.source, updatedAt: rates.updatedAt } },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
