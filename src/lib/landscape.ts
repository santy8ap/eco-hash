/**
 * La cordillera de la portada: las montañas de San Carlos (Antioquia) tejidas con los caracteres del hash del último
 * bloque, y abajo un río de ceros, los mismos con los que empieza todo hash válido (la prueba de trabajo). La forma
 * es fija porque es el lugar; los caracteres cambian con cada bloque. Puro y determinista: el mismo hash da el mismo
 * dibujo, en el servidor y en el navegador.
 */

export const LANDSCAPE_COLS = 144;
export const LANDSCAPE_ROWS = 22;

/**
 * Las cuatro capas de montañas, de la más lejana a la más cercana: alturas entre 0 (abajo) y 1 (arriba) en puntos
 * repartidos a lo ancho. Las cumbres se levantan hacia la derecha; las cercanas son lomas que bajan al río.
 */
const RIDGES: readonly (readonly number[])[] = [
  [0.42, 0.5, 0.62, 0.74, 0.86, 0.94, 0.88, 0.97, 0.9, 0.8, 0.86, 0.93, 0.84],
  [0.32, 0.38, 0.46, 0.56, 0.64, 0.72, 0.66, 0.6, 0.7, 0.74, 0.66, 0.62, 0.7],
  [0.2, 0.24, 0.3, 0.36, 0.42, 0.5, 0.44, 0.52, 0.56, 0.48, 0.42, 0.46, 0.5],
  [0.1, 0.12, 0.16, 0.14, 0.2, 0.24, 0.18, 0.26, 0.21, 0.15, 0.2, 0.24, 0.17],
];

/** Lo menos que se dibuja en lo hondo de cada capa: las lejanas se pierden más en la neblina. */
const FLOOR = [0.12, 0.16, 0.2, 0.28];

const DOT = "·";

/** Altura de una capa en una columna: interpolación coseno entre sus puntos, con una ondulación fina de textura. */
function heightAt(layer: number, col: number, cols: number) {
  const points = RIDGES[layer];
  const t = (col / Math.max(1, cols - 1)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(t));
  const f = (1 - Math.cos((t - i) * Math.PI)) / 2;
  const base = points[i] * (1 - f) + points[i + 1] * f;
  return base + 0.018 * Math.sin(col * 0.9 + layer * 2.1);
}

/** Fila de la cresta de una capa en una columna (0 es la fila de arriba, que siempre queda de cielo). */
function ridgeRow(layer: number, col: number, cols: number, rows: number) {
  return Math.max(1, Math.round((1 - heightAt(layer, col, cols)) * (rows - 1)));
}

const isBlockHash = (hash: string | null | undefined): hash is string => typeof hash === "string" && /^[0-9a-f]{64}$/.test(hash);

/** Ruido fijo por celda (no depende del bloque): la trama del grabado es la misma con cualquier hash. */
function grain(layer: number, r: number, c: number) {
  let h = Math.imul(layer + 1, 374761393) ^ Math.imul(r + 1, 668265263) ^ Math.imul(c + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * ¿Se dibuja esta celda? Como en un grabado: la cresta va completa y hacia abajo la trama se aclara, así las capas
 * se separan como montañas en la neblina. La orilla del río (la última fila) va completa.
 */
function inked(layer: number, depth: number, r: number, c: number, rows: number) {
  if (depth === 0 || (layer === RIDGES.length - 1 && r === rows - 1)) return true;
  return grain(layer, r, c) < Math.max(FLOOR[layer], 0.92 - 0.16 * depth);
}

export interface Landscape {
  /** Una matriz de filas por capa (de la lejana a la cercana); los espacios son cielo o una capa que tapa a otra. */
  layers: string[][];
}

/**
 * Dibuja la cordillera con el hash de un bloque. Sin un hash válido la dibuja con puntos: la forma es la misma, pero
 * no se presenta como un hash que no existe.
 */
export function buildLandscape(hash: string | null | undefined, cols = LANDSCAPE_COLS, rows = LANDSCAPE_ROWS): Landscape {
  // Los ceros iniciales son iguales en todos los bloques: la montaña se teje con lo que sigue.
  const tail = isBlockHash(hash) ? hash.replace(/^0+/, "") : "";
  const layers = RIDGES.map(() => Array.from({ length: rows }, () => [] as string[]));
  for (let c = 0; c < cols; c++) {
    const crest = RIDGES.map((_, layer) => ridgeRow(layer, c, cols, rows));
    for (let r = 0; r < rows; r++) {
      // La capa más cercana cuya cresta está a esta altura o más arriba es la que se ve.
      let owner = -1;
      for (let layer = RIDGES.length - 1; layer >= 0; layer--) {
        if (r >= crest[layer]) {
          owner = layer;
          break;
        }
      }
      for (let layer = 0; layer < RIDGES.length; layer++) {
        const drawn = layer === owner && inked(layer, r - crest[layer], r, c, rows);
        const ch = !drawn ? " " : tail ? tail[(c * 7 + r * 13 + layer * 29) % tail.length] : DOT;
        layers[layer][r].push(ch);
      }
    }
  }
  return { layers: layers.map((rowsOf) => rowsOf.map((chars) => chars.join(""))) };
}

/** Generador pseudoaleatorio con semilla (mulberry32): el río sale igual en cada visita. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** El río: tramos de ceros con huecos, como el agua que corre. Dos filas distintas para que no se vea plano. */
export function riverRows(cols = LANDSCAPE_COLS): string[] {
  return [0x5a17, 0x0c0a].map((seed) => {
    const rand = seeded(seed);
    let row = "";
    while (row.length < cols) {
      row += "0".repeat(2 + Math.floor(rand() * 8));
      row += " ".repeat(1 + Math.floor(rand() * 3));
    }
    return row.slice(0, cols);
  });
}
