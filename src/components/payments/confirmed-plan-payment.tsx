import type { TxDTO } from "@/lib/portfolio";
import { DAYS_PER_MONTH } from "@/lib/mining/plan-math";
import { formatTh } from "@/lib/format";

export function ConfirmedPlanPayment({
  order,
  className,
}: {
  order: Pick<TxDTO, "periodIndex" | "hashrateTh" | "method" | "chainId" | "network">;
  className?: string;
}) {
  const isTest = order.method === "demo" || order.chainId === 97 || /pruebas/i.test(order.network ?? "");

  return (
    <>
      <p className={className}>
        {order.periodIndex ? `Registramos el pago del mes ${order.periodIndex} de tu plan.` : "Registramos el pago de tu plan."}{" "}
        {order.hashrateTh != null && `Tus ${formatTh(order.hashrateTh)} minan durante ${DAYS_PER_MONTH} días. `}
        {(order.periodIndex ?? 0) > 1
          ? "Si pagaste por adelantado, el mes nuevo empieza al terminar el anterior."
          : "Mira en tu panel cómo suben tus sats y el hashprice que quedó fijado para este mes."}
      </p>
      {isTest && <p className="mt-5 rounded-[10px] bg-amber-soft px-4 py-3 text-sm text-amber-text">Operación de prueba: no se movió dinero real.</p>}
    </>
  );
}
