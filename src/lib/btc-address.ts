import { sha256 } from "viem";

/**
 * Validación de direcciones Bitcoin para los retiros. Isomórfico: el formulario avisa antes de enviar y el
 * servidor vuelve a validar. Acepta segwit v0 (bech32, BIP-173), taproot (bech32m, BIP-350) y las direcciones
 * antiguas en base58 con checksum. La red de pruebas solo se acepta en modo de pruebas.
 */

export type BtcNetwork = "mainnet" | "testnet";
export type BtcAddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr";
export type BtcAddressResult =
  | { ok: true; address: string; network: BtcNetwork; type: BtcAddressType }
  | { ok: false; error: string };

const INVALID = "Esa dirección Bitcoin no es válida. Revísala o cópiala de nuevo desde tu billetera.";
const TESTNET = "Esa dirección es de la red de pruebas (testnet). Usa una dirección de la red principal de Bitcoin.";
const EMPTY = "Escribe la dirección Bitcoin de destino.";
const EVM = "Esa es una dirección de Ethereum o BNB Chain. Los retiros se envían en BTC: usa una dirección Bitcoin (empieza por bc1, 1 o 3).";
const LIGHTNING = "Por ahora los retiros se envían en la cadena de Bitcoin, no por Lightning. Usa una dirección que empiece por bc1, 1 o 3.";

/* ───────────── bech32 / bech32m ───────────── */

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function polymod(values: number[]) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GENERATOR[i];
  }
  return chk >>> 0;
}

const hrpExpand = (hrp: string) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];

function bech32Decode(raw: string) {
  if (raw !== raw.toLowerCase() && raw !== raw.toUpperCase()) return null;
  const str = raw.toLowerCase();
  const sep = str.lastIndexOf("1");
  if (str.length > 90 || sep < 1 || sep + 7 > str.length) return null;
  const hrp = str.slice(0, sep);
  const data: number[] = [];
  for (const c of str.slice(sep + 1)) {
    const v = CHARSET.indexOf(c);
    if (v < 0) return null;
    data.push(v);
  }
  const check = polymod([...hrpExpand(hrp), ...data]);
  const encoding = check === BECH32_CONST ? "bech32" : check === BECH32M_CONST ? "bech32m" : null;
  if (!encoding) return null;
  return { hrp, data: data.slice(0, -6), encoding, address: str } as const;
}

/** Reagrupa bits (de 5 en 5 a 8 en 8) sin relleno, como exige una dirección segwit. */
function convertBits(data: number[], from: number, to: number) {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const max = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & max);
    }
  }
  if (bits >= from || (acc << (to - bits)) & max) return null;
  return out;
}

function parseSegwit(raw: string): BtcAddressResult | null {
  const decoded = bech32Decode(raw);
  if (!decoded) return null;
  const network: BtcNetwork | null = decoded.hrp === "bc" ? "mainnet" : decoded.hrp === "tb" ? "testnet" : null;
  if (!network || decoded.data.length < 1) return null;
  const version = decoded.data[0];
  const program = convertBits(decoded.data.slice(1), 5, 8);
  if (!program || program.length < 2 || program.length > 40 || version > 16) return null;
  // BIP-350: la versión 0 usa bech32 y las demás bech32m.
  if ((version === 0) !== (decoded.encoding === "bech32")) return null;
  let type: BtcAddressType | null = null;
  if (version === 0 && program.length === 20) type = "p2wpkh";
  else if (version === 0 && program.length === 32) type = "p2wsh";
  else if (version === 1 && program.length === 32) type = "p2tr";
  if (!type) return null;
  return { ok: true, address: decoded.address, network, type };
}

/* ───────────── base58check ───────────── */

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(str: string) {
  let num = BigInt(0);
  for (const c of str) {
    const v = BASE58.indexOf(c);
    if (v < 0) return null;
    num = num * BigInt(58) + BigInt(v);
  }
  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num % BigInt(256)));
    num /= BigInt(256);
  }
  for (const c of str) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

const VERSIONS: Record<number, { network: BtcNetwork; type: BtcAddressType }> = {
  0x00: { network: "mainnet", type: "p2pkh" },
  0x05: { network: "mainnet", type: "p2sh" },
  0x6f: { network: "testnet", type: "p2pkh" },
  0xc4: { network: "testnet", type: "p2sh" },
};

function parseBase58(raw: string): BtcAddressResult | null {
  if (raw.length < 26 || raw.length > 35) return null;
  const bytes = base58Decode(raw);
  if (!bytes || bytes.length !== 25) return null;
  const payload = bytes.slice(0, 21);
  const checksum = sha256(sha256(payload, "bytes"), "bytes").slice(0, 4);
  if (!checksum.every((b, i) => b === bytes[21 + i])) return null;
  const kind = VERSIONS[payload[0]];
  return kind ? { ok: true, address: raw, ...kind } : null;
}

/* ───────────── entrada ───────────── */

/** Quita espacios y el prefijo `bitcoin:` (y sus parámetros) de una dirección pegada desde un QR. */
function clean(raw: string) {
  let s = raw.trim();
  if (/^bitcoin:/i.test(s)) s = s.slice(8).split("?")[0];
  return s;
}

export function parseBtcAddress(raw: string, opts: { allowTestnet: boolean }): BtcAddressResult {
  const s = clean(typeof raw === "string" ? raw : "");
  if (!s) return { ok: false, error: EMPTY };
  if (/^0x[0-9a-f]{40}$/i.test(s)) return { ok: false, error: EVM };
  if (/^(lightning:|lnbc|lntb)/i.test(s) || s.includes("@")) return { ok: false, error: LIGHTNING };
  const parsed = /^(bc1|tb1)/i.test(s) ? parseSegwit(s) : parseBase58(s);
  if (!parsed) return { ok: false, error: INVALID };
  if (parsed.ok && parsed.network === "testnet" && !opts.allowTestnet) return { ok: false, error: TESTNET };
  return parsed;
}

/** Una dirección larga para mostrar en poco espacio: bc1qw508…v8f3t4. */
export function shortBtcAddress(address: string) {
  return address.length > 18 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}
