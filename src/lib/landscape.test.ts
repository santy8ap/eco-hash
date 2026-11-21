import { describe, expect, it } from "vitest";
import { LANDSCAPE_COLS, LANDSCAPE_ROWS, buildLandscape, riverRows } from "@/lib/landscape";

const HASH = "000000000000000000009a8ab3bb70cc9ef6855a3af7fc4da4583142d57e2f3a";
const OTHER = "00000000000000000001bc5f7cd24c37fda0f0a43fcb95a35c1971deb0fd481e";
const TAIL = new Set(HASH.replace(/^0+/, ""));

/** Qué capa ocupa cada celda: la forma del dibujo, sin importar los caracteres. */
const shape = (layers: string[][]) => layers.map((rows) => rows.map((row) => row.replace(/[^ ]/g, "#")));

describe("cordillera de la portada", () => {
  const { layers } = buildLandscape(HASH);

  it("son cuatro capas de montañas, de la más lejana a la más cercana, del mismo tamaño", () => {
    expect(layers).toHaveLength(4);
    for (const rows of layers) {
      expect(rows).toHaveLength(LANDSCAPE_ROWS);
      for (const row of rows) expect(row).toHaveLength(LANDSCAPE_COLS);
    }
  });

  it("cada celda es de una sola capa: la montaña cercana tapa a la lejana", () => {
    for (let r = 0; r < LANDSCAPE_ROWS; r++) {
      for (let c = 0; c < LANDSCAPE_COLS; c++) {
        expect(layers.filter((rows) => rows[r][c] !== " ").length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("arriba queda cielo y abajo, la orilla del río es la montaña más cercana, de lado a lado", () => {
    expect(layers.every((rows) => rows[0].trim() === "")).toBe(true);
    expect(layers[3][LANDSCAPE_ROWS - 1]).not.toContain(" ");
  });

  it("como un grabado: la cresta de cada capa va completa y hacia abajo se aclara, para que las capas se separen", () => {
    for (const rows of layers.slice(0, 3)) {
      let crest = 0;
      let crestDrawn = 0;
      let deep = 0;
      let deepDrawn = 0;
      for (let c = 0; c < LANDSCAPE_COLS; c++) {
        const top = rows.findIndex((row) => row[c] !== " ");
        if (top < 0) continue;
        crest++;
        crestDrawn++;
        // Cuatro filas o más por debajo de la cresta, mientras la capa no esté tapada por otra.
        for (let r = top + 4; r < LANDSCAPE_ROWS; r++) {
          if (layers.some((other, i) => i > layers.indexOf(rows) && other[r][c] !== " ")) break;
          deep++;
          if (rows[r][c] !== " ") deepDrawn++;
        }
      }
      expect(crestDrawn / crest).toBe(1);
      expect(deepDrawn / Math.max(1, deep)).toBeLessThan(0.6);
    }
  });

  it("la montaña lejana asoma por encima de las demás en algún punto", () => {
    const topOf = (rows: string[], c: number) => rows.findIndex((row) => row[c] !== " ");
    const peaks = Array.from({ length: LANDSCAPE_COLS }, (_, c) => topOf(layers[0], c)).filter((r) => r >= 0);
    expect(peaks.length).toBeGreaterThan(LANDSCAPE_COLS / 2);
  });

  it("se teje con los caracteres del hash que siguen a los ceros iniciales", () => {
    const used = new Set(layers.flat().join("").replace(/ /g, ""));
    for (const ch of used) expect(TAIL.has(ch)).toBe(true);
    // Usa casi todo el alfabeto del hash, no un solo carácter repetido.
    expect(used.size).toBeGreaterThan(8);
  });

  it("el mismo bloque da el mismo dibujo; otro bloque cambia los caracteres pero no la montaña", () => {
    expect(buildLandscape(HASH)).toEqual(buildLandscape(HASH));
    const other = buildLandscape(OTHER).layers;
    expect(other).not.toEqual(layers);
    expect(shape(other)).toEqual(shape(layers));
  });

  it("sin un hash válido la montaña es de puntos: no se inventa un hash", () => {
    for (const hash of [null, "", "no-es-un-hash", HASH.slice(1)]) {
      const dots = buildLandscape(hash).layers;
      expect(shape(dots)).toEqual(shape(layers));
      expect(new Set(dots.flat().join("").replace(/ /g, ""))).toEqual(new Set(["·"]));
    }
  });
});

describe("río de ceros", () => {
  it("dos filas de ceros con huecos, del ancho del dibujo, siempre iguales", () => {
    const rows = riverRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveLength(LANDSCAPE_COLS);
      expect(row).toMatch(/^[0 ]+$/);
      const zeros = row.replace(/ /g, "").length;
      expect(zeros).toBeGreaterThan(LANDSCAPE_COLS * 0.4);
      expect(zeros).toBeLessThan(LANDSCAPE_COLS * 0.9);
    }
    expect(rows[0]).not.toEqual(rows[1]);
    expect(riverRows()).toEqual(rows);
  });
});
