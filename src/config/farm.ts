/**
 * La granja de minería. El nombre, la ubicación, la capacidad y el hashprice son los valores iniciales:
 * el admin puede cambiarlos. La energía, la eficiencia y el tamaño de cada minero son informativos.
 */
export const FARM = {
  /** Llave de la fila en la base de datos */
  id: "eco-hash-farm-1",
  name: "Granja Hidro I",
  location: "San Carlos, Antioquia",
  /** Capacidad total que se puede vender (TH/s): 30 PH/s */
  capacityTh: 30_000,
  /** De dónde sale la energía de la granja */
  energy: "Hidroeléctrica de pasada",
  /** Eficiencia de los mineros (julios por terahash) */
  efficiencyJTh: 17,
  /** Hashrate de cada minero ASIC (TH/s): una celda de la cuadrícula de la granja */
  minerTh: 200,
} as const;

/** Hashprice inicial: sats que mina 1 TH/s en un día. Cada mes pagado guarda el vigente al activarse. */
export const DEFAULT_HASHPRICE_SATS = 42;
