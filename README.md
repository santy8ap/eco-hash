# eco-hash

Planes de hashrate para minar Bitcoin. El cliente contrata TH/s en una granja que funciona con energía hidroeléctrica, paga mes a mes en pesos y ve sus sats sumar cada segundo en su panel. Retira sus sats a su propia dirección Bitcoin.

Este proyecto nació del código de solaxy-mvp, del que conserva el ingreso con Google, los pagos, el admin, los correos y las pruebas. El dominio, los datos y la interfaz son nuevos. El diseño está en [docs/superpowers/specs/2026-11-20-eco-hash-design.md](docs/superpowers/specs/2026-11-20-eco-hash-design.md).

## Cómo funciona

- **Planes.** Hay cuatro: Nonce (100 TH/s), Bloque (250 TH/s), Cadena (500 TH/s) y Génesis (1.000 TH/s). Cada uno es un contrato de 3 meses que se paga mes a mes. El precio se fija por TH/s al mes ($ 2.600, $ 2.500, $ 2.400 y $ 2.300), incluye la energía y el mantenimiento, y cada plan comprado conserva el suyo aunque el admin cambie el catálogo.
- **Minería.** Es lineal y no se detiene: `sats = TH/s × hashprice × días`. El **hashprice** son los sats que mina 1 TH/s en un día (42 al empezar). Lo fija el admin, y **cada mes pagado guarda el hashprice vigente cuando se confirma su pago**. Ese mes mina con ese valor aunque el admin lo cambie después.
- **Saldo y retiros.** El saldo es lo minado (redondeado hacia abajo) menos los retiros enviados y los que están en revisión. Se retira desde 50.000 sats a una dirección Bitcoin (bech32, taproot o base58; la red de pruebas solo funciona en modo de pruebas). El equipo envía los BTC y registra el txid de 64 caracteres, que el cliente ve en sus movimientos con su enlace a mempool.space.
- **Granja.** Tiene una capacidad en TH/s (30.000 al empezar). Los planes activos, en pausa o en conciliación ocupan su hashrate: si no cabe, no se vende, y un pago que llega sin capacidad queda por reembolsar.
- **Pausa y cierre.** Si un mes vence sin pagar, el plan deja de minar y tiene 15 días para retomarse; después se cierra y libera su capacidad. Lo ya minado se conserva.
- **Red Bitcoin.** La altura, el hash del último bloque, el hashrate de la red, la dificultad, el próximo ajuste y el hashprice de la red vienen de mempool.space, con 60 s de caché. El precio del BTC se mueve en tiempo real: el navegador escucha cada operación de BTC-USD en el canal público de Coinbase (WebSocket, sin llave) y la pasa a pesos con la tasa de CoinGecko, que el servidor consulta cada minuto. Mientras Coinbase conecta, o si no responde, se usa el precio de CoinGecko. Si mempool.space o CoinGecko no responden, la página usa valores de referencia y los rotula así. Nunca inventa un hash.
- **Estimaciones.** El valor en pesos de lo minado y la rentabilidad se calculan con el precio del BTC en vivo (o el de CoinGecko) y siempre se presentan como estimaciones. Con el precio de referencia no se estima nada en pesos.

Las cifras del panel salen de esa fórmula: no son telemetría de una máquina en particular. El mapa de la granja del inicio muestra la capacidad contratada y la libre en celdas de 200 TH/s.

## Desarrollo

Se requieren Node.js 20.9 o superior y npm.

```bash
npm ci
npm run setup
npm run dev
```

Abre <http://localhost:3000>. `setup` crea `.env.local` si falta y genera las claves locales. La base local queda en `data/eco-hash.db`. Con `DEMO_MODE=true` puedes entrar con la cuenta de pruebas y pagar con el pago de prueba.

```bash
npm run lint
npm test
npm run build
npm start
```

## Recorrido del cliente

1. Elige un plan en el inicio o en `/panel/planes` (`/comprar?plan=h100`, `h250`, `h500` o `h1000`).
2. Entra con Google (o con la cuenta de pruebas) y completa sus datos personales: nombre, documento, celular, ciudad y la aceptación de los términos.
3. Revisa el resumen: mensualidad, minería estimada del mes con el hashprice de hoy y su valor al precio del BTC del día.
4. Paga con Mercado Pago (tarjeta, PSE o Nequi), transferencia bancaria, USDT/BNB en BNB Smart Chain o, en modo de pruebas, con el pago de prueba.
5. En el panel ve el contador de sats en vivo, los sats por día (7, 30 o 90 días, con tabla y CSV), sus planes, sus movimientos con comprobante PDF y sus avisos.
6. Retira a su billetera Bitcoin desde **Billetera**.

## Administración

Se entra con Google: los correos de `ADMIN_EMAILS` son propietarios y eligen al resto del equipo en **Admin → Equipo**. Secciones:

- **Resumen:** lo pendiente (transferencias, retiros por enviar, devoluciones), el hashrate contratado frente a la capacidad, el recaudo, los sats que se les deben a los clientes y el hashprice vigente.
- **Análisis:** recaudo por mes y por medio, embudo, mensualidades que vienen y capacidad de la granja.
- **Clientes**, con la ficha de cada uno; **Pagos**; y **Retiros**, donde se copia la dirección y el monto en BTC y se registra el txid.
- **Granja:** nombre, ubicación, capacidad, hashprice (con un botón para usar el hashprice de la red de ese momento) y precios de los planes, con la estimación para el cliente al precio del BTC de hoy.
- **Equipo**, **Configuración** (lista para cobrar de verdad, cuenta para transferencias, soporte, alertas, respaldo y estado del sistema) y **Actividad**.

## Configuración y despliegue

Consulta [.env.example](.env.example). Lo mínimo para publicar en modo de pruebas es `BETTER_AUTH_SECRET`. Lo demás se agrega cuando haga falta:

| Configuración | Para qué |
| --- | --- |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sesiones y URL pública |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ingreso con Google (redirección: `https://tu-dominio/api/auth/callback/google`) |
| `ADMIN_EMAILS` | Propietarios de la administración |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos persistente en Vercel |
| `PREVIEW_TURSO_DATABASE_URL`, `PREVIEW_TURSO_AUTH_TOKEN` | Base propia de las vistas previas |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Cobros con Mercado Pago (webhook: `https://tu-dominio/api/webhooks/mercadopago`, evento Pagos) |
| `CRYPTO_TREASURY_ADDRESS`, `CRYPTO_NETWORK`, `CRYPTO_CONFIRMATIONS` | Pagos en USDT/BNB |
| `BSC_RPC_URL`, `USDT_CONTRACT`, `COINGECKO_API_KEY`, `MEMPOOL_API_BASE` | Ajustes opcionales de red y precios |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Conexión de wallet por QR para pagar en cripto |
| `CRON_SECRET` | Tarea diaria `/api/cron/payments` |
| `RESEND_API_KEY`, `ALERT_EMAIL`, `ALERT_FROM`, `CUSTOMER_EMAIL_FROM` | Alertas al equipo y correos a los clientes |
| `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP` | Contactos oficiales (también desde el admin) |
| `DEMO_MODE` | `true`: pruebas; `false`: cobros reales |

**Sin Turso, la base de Vercel es temporal** (un archivo en `/tmp` que se pierde cuando la función se reinicia). Sirve para mostrar la demo, no para operar: conecta Turso desde Vercel → Storage antes de recibir clientes.

Las migraciones se aplican solas al arrancar. La tabla de control es `__ecohash_migrations` y la migración inicial crea todo el esquema (`farm`, `plan_subscription` y `plan_period` con TH/s y hashprice, `ledger_tx` con `hashrate_th` y `amount_sats`).

Publicar el código no activa cobros reales. Antes de abrir al público hay que completar los datos legales de `src/config/legal.ts` con el abogado (los textos de términos y privacidad tienen los espacios marcados), reemplazar los datos de la granja por los reales, poner el contacto oficial, las credenciales de producción y `DEMO_MODE=false`. La lista de **Admin → Configuración** mantiene esos pendientes a la vista.

## Pruebas

`npm test` cubre la matemática de minería y de los planes, el validador de direcciones Bitcoin (con los vectores de BIP-173 y BIP-350), los retiros en sats (mínimo, concurrencia, doble clic y txid), la capacidad de la granja, el hashprice que fija cada mes, pagos y devoluciones, el cuadre de los números entre las pantallas del admin, los correos y los datos de la red con su respaldo.

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright levanta el servidor en `127.0.0.1:4173` con una base temporal y recorre el inicio, la compra con el pago de prueba, el panel, la billetera, la transferencia bancaria, el admin, los datos personales y los temas, en escritorio y en celular. GitHub Actions corre lint, pruebas, build y estos recorridos en cada cambio a `main`.
