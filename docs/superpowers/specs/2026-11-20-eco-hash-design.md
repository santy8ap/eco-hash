# Diseño: eco-hash, planes de hashrate para minar Bitcoin

**Fecha:** 20 de noviembre de 2026. Parte del código de solaxy-mvp (commit `21aadc7`) para ahorrar tiempo, pero es otro producto con otra cara.

## Lo que pidió el dueño

- Un repo y un proyecto de Vercel nuevos llamados **eco-hash**, hechos a partir del MVP de solaxy.
- En vez de energía (kW/kWh), el producto vende **terahashes (TH/s)**, y todo gira en torno a la **minería de Bitcoin**.
- Libertad creativa. **No debe parecerse mucho a solaxy**: solo se toma su código. Referencias visuales que mandó: dashboards oscuros de cloud mining y un pool de minería con gráficas ámbar.

## Metas, no metas y anti-metas

- **Metas:** comprar un plan de TH/s, pagarlo mes a mes con los medios que ya existen y ver los sats minados subir cada segundo. Retirar en BTC. Administrar la granja, el hashprice, los pagos y los retiros desde el admin. Publicarlo en Vercel.
- **No metas:** telemetría real de máquinas, pool propio, pagos en BTC on-chain para comprar planes, mercado entre usuarios.
- **Anti-metas:** que se vea como solaxy (blanco y negro, titulares condensados en mayúsculas, reloj solar). Presentar cifras simuladas como si fueran mediciones. Prometer una rentabilidad fija en pesos.

## Enfoques considerados

1. **Solo cambiar las unidades** (kWh → TH/s) y abonar el rendimiento en pesos a una tarifa fija. Es lo más barato, pero no es minería: el saldo en pesos con tarifa fija se lee como un producto de rentabilidad garantizada.
2. **Minería nativa en BTC (elegido).** El hashrate mina sats a un hashprice (sats por TH/s al día). El saldo y los retiros son en BTC, y los pesos se muestran como equivalente al precio del momento. Es lo que hace un servicio de minería de verdad y reutiliza casi toda la estructura de periodos, cupo y pagos.
3. **Proyecto desde cero** con otra pila. Se pierden el login, los pagos, el admin, los correos y las pruebas, que es justo lo que se quería ahorrar.

## Reglas del negocio

### Planes (contrato de 3 meses, pagado mes a mes en pesos)

| Plan | Hashrate | Precio por TH/s al mes | Mensualidad |
| --- | --- | --- | --- |
| Nonce | 100 TH/s | $ 2.600 | $ 260.000 |
| Bloque | 250 TH/s | $ 2.500 | $ 625.000 |
| Cadena | 500 TH/s | $ 2.400 | $ 1.200.000 |
| Génesis | 1.000 TH/s | $ 2.300 | $ 2.300.000 |

- Precios recalibrados al publicar (20 de noviembre de 2026), con el BTC real en unos 201,8 millones de pesos (US$ 58.900) y 42 sats por TH/s al día: el Nonce queda cerca del punto de equilibrio y los planes grandes, con descuento por volumen. Los primeros valores ($ 4.600 a $ 4.200) suponían un BTC de 420 millones y mostraban una pérdida de cerca del 40 % al precio real.

- La mensualidad incluye la energía y el mantenimiento: no hay cobros diarios de electricidad.
- El admin cambia los precios. Cada plan comprado guarda su precio por TH/s.
- Periodos de 30 días, 15 días de gracia y estados (`activa`, `en_pausa`, `completada`, `vencida`, `cancelada`, `en_revision`): igual que en el código base.

### Minería

- La minería es **24/7 y lineal**: `sats = TH/s × hashprice × días`. No hay curva de horario.
- **Hashprice:** sats por TH/s al día. Lo fija el admin (valor inicial: 42). **Cada mes pagado guarda el hashprice vigente al confirmarse el pago**, y ese mes mina a ese valor aunque el admin lo cambie después.
- La **rentabilidad** se calcula al precio del BTC **en tiempo real**: el navegador recibe cada operación de BTC-USD del canal público de Coinbase (WebSocket) y la convierte a pesos con la tasa de CoinGecko. Mientras conecta, o si Coinbase no responde, usa el precio de CoinGecko (cada minuto). Con el precio de referencia (sin CoinGecko ni Coinbase) no se estima nada en pesos. Siempre se muestra como estimada.
- **Saldo** = sats minados (redondeados hacia abajo) − retiros pagados − retiros en revisión.

### Granja

- La planta pasa a ser la **granja**: nombre, ubicación, **capacidad en TH/s** (valor inicial: 30.000 TH/s, 30 PH/s) y energía renovable (hidroeléctrica). El cupo funciona igual que antes, sumando TH/s en vez de kWh diarios.
- Los datos de la red Bitcoin (altura de bloque, hashrate de la red, ajuste de dificultad y hashprice de la red) se leen de mempool.space, con caché y valores de referencia si no responde. Son reales cuando la API responde y se rotulan como referencia cuando no.

### Retiros

- **Solo en BTC, a una dirección Bitcoin** (bech32, bech32m o base58 con checksum; testnet solo en modo de pruebas). Sin firma de wallet.
- El mínimo es de 50.000 sats. El retiro aparta el saldo, el admin envía y registra el **txid**, o lo rechaza con un motivo. Se guarda también el equivalente en pesos del momento, solo como referencia.
- Desaparecen los retiros a cuenta bancaria y a wallet USDT. Los pagos con USDT/BNB se conservan como medio para pagar planes.

## Datos

- Migraciones nuevas desde cero (base nueva; no hay datos que conservar). La tabla de control pasa a llamarse `__ecohash_migrations`.
- `farm` (antes `plant`): `name`, `location`, `capacity_th`, `sats_per_th_day`, `plan_prices`, `updated_at`.
- `plan_subscription`: `hashrate_th` y `price_cop_per_th_month` (en vez de `total_kwh`, `daily_kwh`, `price_cop_per_kwh` y `sale_cop_per_kwh`).
- `plan_period`: `hashrate_th` y `sats_per_th_day` (el hashprice que fija ese mes).
- `ledger_tx`: `hashrate_th` (en vez de `kwh`) y `amount_sats` (retiros). Se quitan las columnas bancarias.

## Cara nueva

- **Marca:** eco-hash, con un símbolo de bloque y hoja. La sigla de las referencias de pago es `ECH`.
- **Color:** grafito casi negro, superficies elevadas, **ámbar Bitcoin** para la marca, las acciones y las gráficas, y **verde** para "en línea" y las cifras positivas. Tema oscuro por defecto, más uno claro.
- **Forma:** tarjetas con esquinas redondeadas, campos con caja, navegación lateral en el panel (barra inferior en celular), cifras en monoespaciada.
- **Inicio:** hero con un minero en vivo (sats subiendo), franja de la red Bitcoin, la granja como cuadrícula de mineros (vendidos/libres), planes en tarjetas, cómo funciona, preguntas.
- **Panel:** indicadores (hashrate activo, minado total, minado hoy, saldo), gráfica de barras de sats por día (7/30/90), planes, movimientos y reloj de bloques.
- Se respeta `prefers-reduced-motion`.

## Pruebas

- Unitarias primero para la matemática de minería, la economía de los planes, el validador de direcciones y los retiros en sats. Las de pagos, cupo, conciliación y admin se adaptan al nuevo dominio.
- Recorridos e2e adaptados a los textos nuevos.
- `lint`, `test` y `build` en verde antes de publicar.

## Despliegue

- Repo `santy8ap/eco-hash`, historial nuevo. Un primer commit con el código base y luego la conversión en commits por partes.
- Proyecto de Vercel `eco-hash` en *santy8ap's projects*, conectado al repo. Arranca en `DEMO_MODE=true` con `BETTER_AUTH_SECRET` aleatoria, y `ADMIN_EMAILS` contiene solo la cuenta de pruebas para mostrar el admin. Sin Turso, la base es temporal: el dueño conecta Turso, Google y Mercado Pago cuando quiera cobrar de verdad.

## Lo que queda a criterio de quien construye

Nombres de componentes, la tipografía exacta y los textos de apoyo. También el detalle de las gráficas, siempre dentro de la dirección visual descrita arriba.
