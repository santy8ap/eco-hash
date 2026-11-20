import { describe, expect, it } from "vitest";
import { privateUrl } from "@/components/analytics/vercel";

describe("lo que se envía a la analítica de Vercel", () => {
  it("las páginas públicas y del cliente van sin parámetros", () => {
    expect(privateUrl("https://eco-hash.vercel.app/")).toBe("https://eco-hash.vercel.app/");
    expect(privateUrl("https://eco-hash.vercel.app/comprar?plan=h100")).toBe("https://eco-hash.vercel.app/comprar");
    expect(privateUrl("https://eco-hash.vercel.app/pagos/resultado?ref=ECH-12345ABCDE&status=approved")).toBe("https://eco-hash.vercel.app/pagos/resultado");
    expect(privateUrl("https://eco-hash.vercel.app/panel/billetera#historial")).toBe("https://eco-hash.vercel.app/panel/billetera");
  });

  it("el admin y la API no se miden", () => {
    expect(privateUrl("https://eco-hash.vercel.app/admin")).toBeNull();
    expect(privateUrl("https://eco-hash.vercel.app/admin/pagos?estado=todos")).toBeNull();
    expect(privateUrl("https://eco-hash.vercel.app/api/config")).toBeNull();
    expect(privateUrl("https://eco-hash.vercel.app/administracion")).toBe("https://eco-hash.vercel.app/administracion");
    expect(privateUrl("no es una url")).toBeNull();
  });
});
