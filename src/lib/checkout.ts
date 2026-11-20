/** Condiciones que el servidor presenta antes de pagar un mes del plan. */
export interface CheckoutRequest {
  planId?: string;
  subscriptionId?: string;
  planName: string;
  periodIndex: number;
  months: number;
  /** Hashrate del mes (TH/s) */
  hashrateTh: number;
  amountCop: number;
  priceCopPerThMonth: number;
  /** Hashprice vigente: con él se estiman los sats del mes; el definitivo se fija al confirmar el pago */
  satsPerThDay: number;
}
