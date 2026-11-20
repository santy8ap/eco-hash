# Guion de la demo (6 minutos)

## Antes

- Abre la página publicada (o `npm run build && npm start` en local) con `DEMO_MODE=true`.
- Ten dos pestañas: el inicio y el panel con la cuenta de pruebas.
- Si quieres mostrar el admin con la cuenta de pruebas, su correo (`pruebas@eco-hash.local`) debe estar en `ADMIN_EMAILS`.

## 1. La idea (30 s), en el inicio

> «eco-hash te deja minar Bitcoin sin comprar máquinas: contratas hashrate en una granja hidroeléctrica, pagas cada mes en pesos y recibes sats».

- Señala el **bloque en vivo**: la altura y el hash del último bloque de la red Bitcoin, con sus ceros al principio. «Eso es minar: buscar un hash que empiece con suficientes ceros».
- El contador de abajo: lo que un plan de 100 TH/s ha minado desde que abriste la página.

## 2. La granja y los planes (1 min)

- **La granja:** capacidad, eficiencia y el mapa de mineros contratados y libres.
- **Los planes:** hashrate, mensualidad, sats estimados al mes y su valor al precio del BTC de hoy. Aclara que es una estimación: depende del hashprice y del precio del BTC.

## 3. Comprar (1 min 30 s)

1. **Elegir Génesis** → **Entrar con la cuenta de pruebas**.
2. Datos personales → resumen: mensualidad y minería estimada del mes.
3. **Pago de prueba** → pago confirmado, con su comprobante PDF.

## 4. El panel (1 min 30 s)

- El contador de sats subiendo cada segundo y el ritmo en sats por segundo.
- Las lecturas: hashrate activo, minado hoy, saldo y resultado al precio de hoy.
- La gráfica de sats por día (con vista de tabla y CSV).
- **Billetera → Retirar a mi billetera:** se pide en sats a una dirección Bitcoin, que se valida antes de enviar.

## 5. El admin (1 min)

- **Resumen:** hashrate vendido frente a la capacidad, recaudo y sats que se les deben a los clientes.
- **Granja:** el hashprice y el botón para usar el de la red ese día. «Cada mes que se activa guarda su hashprice».
- **Retiros:** copiar dirección y monto en BTC, enviar desde la billetera de eco-hash y registrar el txid.

## Preguntas probables

**¿Los números son reales?** Los de la red Bitcoin sí (mempool.space y CoinGecko). Los de cada cliente salen de la fórmula TH/s × hashprice × tiempo, con el hashprice que fija cada mes.

**¿Cómo gana eco-hash?** Con la diferencia entre la mensualidad y el costo real de minar ese hashrate (energía, equipos y operación).

**¿Es legal?** Antes de abrir al público hay que definir la figura jurídica con un abogado (los términos tienen los espacios marcados) y revisar las normas de criptoactivos y captación.
