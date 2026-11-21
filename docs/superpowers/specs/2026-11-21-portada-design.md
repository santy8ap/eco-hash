# Portada de eco-hash: «Bitcoin minado con agua de río»

Rediseño de la página principal (solo la portada; el panel, la compra y el admin siguen con Basalto). Pedido: un
front «menos IA slop» y más creativo, con libertad creativa.

## Qué se veía genérico

- Todo era la misma tarjeta oscura redondeada con borde fino.
- El orden de cualquier landing generada: héroe con dos botones, franja de cifras, precios, «Cómo funciona» en 1-2-3,
  preguntas y una caja final.
- Negro, ámbar y verde neón con brillos difuminados.
- Nada real: ni la granja ni el río; el mapa de contenedores era una cuadrícula vacía.

## Concepto

La granja es una central de pasada en San Carlos, Antioquia. La portada lo cuenta con el propio material de Bitcoin:

- **La cordillera del último bloque.** Las montañas de Antioquia en cuatro capas, tejidas con los caracteres del hash
  del último bloque (los que siguen a sus ceros iniciales). Abajo corre un río hecho con ceros, los mismos con que
  empieza todo hash válido. La forma es fija (es el lugar); los caracteres cambian con cada bloque, más o menos cada
  10 minutos. Se dibuja como un grabado: la cresta de cada capa va completa y hacia abajo la trama se aclara, así las
  capas se separan como montañas en la neblina. Sin hash real (mempool.space caído) se dibuja con puntos: no se
  inventa un hash.
- **Del río a tu billetera.** La granja como el recorrido del agua, con una cifra de hoy en cada parada: río (de
  pasada), casa de máquinas (kW a plena capacidad), contenedores (mineros y lo contratado), red Bitcoin (la parte de
  la granja en el hashrate del mundo) y tu panel (el hashprice del mes). En escritorio, la línea del agua cae hasta las
  turbinas y sigue plana; en celular baja por la izquierda.
- **Tarifario.** Los planes como una hoja de tarifas, sin tarjetas: el hashrate en grande, lo que se paga, lo que
  mina y su valor al precio del BTC en vivo.
- Se quitaron la sección «Cómo funciona» de tres tarjetas y la caja final: los tres pasos van en el cierre, bajo el
  río de ceros, que vuelve a aparecer quieto.

## Sistema

- **Letra.** Big Shoulders (condensada, como los letreros pintados de una central) solo para los titulares, en tipo de
  oración. Geologica para el texto y las cifras (dígitos tabulares). Martian Mono solo para hashes y el dibujo.
- **Color.** La base de Basalto (#0d1311 / #f2f4f0) y el ámbar de marca para las acciones. Nuevo: cuatro tonos de
  montaña (de lo lejano, que se pierde en lo oscuro o en la neblina, a lo cercano) y un azul verdoso para el agua
  (#5db7c4 oscuro, #1a7684 claro), que no compite con el ámbar ni con el jade de «en línea».
- **Movimiento.** Uno solo que no pide nadie: el río corre despacio (140 y 190 s por vuelta). Con un bloque nuevo, los
  caracteres de la montaña aparecen con un fundido corto. Con movimiento reducido, todo quieto.

## Decisiones

- La cordillera no se superpone al texto: con el titular en dos líneas, el dibujo cabe arriba del pliegue en
  escritorio, a lo ancho, debajo del héroe. A la derecha del héroe va la leyenda del bloque (altura, hace cuánto, hash
  y el enlace a mempool.space).
- Los estilos de la portada viven en `@layer components`, para que las utilidades de Tailwind puedan ajustar cada caso.
- El dibujo es un SVG con una fila de texto por capa y `textLength`: las 144 columnas quedan alineadas en cualquier
  pantalla; en celular se recorta el centro (`slice`) para que los caracteres se lean.
