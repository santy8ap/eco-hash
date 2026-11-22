/**
 * Destinos internos permitidos después del ingreso: la compra, el panel y el admin (el admin revisa el rol en cada
 * página). Nunca acepta una URL externa ni la API.
 */
export function safeReturnTo(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://internal.invalid");
    if (
      url.origin !== "https://internal.invalid" ||
      !(url.pathname === "/comprar" || /^\/(?:panel|admin)(?:\/|$)/.test(url.pathname))
    )
      return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export const planCheckoutHref = (planId: string) =>
  `/comprar?plan=${encodeURIComponent(planId)}`;
export const renewalCheckoutHref = (subscriptionId: string) =>
  `/comprar?suscripcion=${encodeURIComponent(subscriptionId)}`;

/**
 * El ingreso para quien una página o la API acaba de mandar a ingresar, con regreso a `returnTo`; si es una página
 * del admin, abre directo la opción «Administrador». Lleva «sesion=cerrada» (ver sessionWasRejected).
 */
export function loginHref(returnTo: string) {
  const next = safeReturnTo(returnTo) ?? "/panel";
  const params = new URLSearchParams(next.startsWith("/admin") ? { rol: "admin", next } : { next });
  params.set("sesion", "cerrada");
  return `/ingresar?${params}`;
}

/**
 * ¿Se llegó a ingresar porque el destino no reconoció la sesión? Entonces ingresar no devuelve solo al destino
 * aunque aquí la sesión sí aparezca: el destino la rechazaría otra vez y la página quedaría rebotando sin fin
 * (pasaba en Vercel sin una base compartida, donde cada función tiene la suya).
 */
export const sessionWasRejected = (sesion: unknown) => sesion === "cerrada";
