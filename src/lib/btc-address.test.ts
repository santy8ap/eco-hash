import { describe, expect, it } from "vitest";
import { parseBtcAddress } from "./btc-address";

const main = { allowTestnet: false };
const test = { allowTestnet: true };

describe("direcciones Bitcoin válidas", () => {
  it("acepta segwit v0 (BIP-173), en minúsculas o todo en mayúsculas, y la guarda en minúsculas", () => {
    expect(parseBtcAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", main)).toEqual({
      ok: true,
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      network: "mainnet",
      type: "p2wpkh",
    });
    expect(parseBtcAddress("  BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4 ", main)).toMatchObject({
      ok: true,
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    });
    expect(parseBtcAddress("bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3", main)).toMatchObject({ ok: true, type: "p2wsh" });
  });

  it("acepta taproot (BIP-350, bech32m)", () => {
    expect(parseBtcAddress("bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", main)).toMatchObject({ ok: true, type: "p2tr", network: "mainnet" });
  });

  it("acepta las direcciones antiguas en base58 con su checksum", () => {
    expect(parseBtcAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", main)).toEqual({
      ok: true,
      address: "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
      network: "mainnet",
      type: "p2pkh",
    });
    expect(parseBtcAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", main)).toMatchObject({ ok: true, type: "p2sh" });
  });

  it("en modo de pruebas acepta testnet", () => {
    expect(parseBtcAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", test)).toMatchObject({ ok: true, network: "testnet", type: "p2wpkh" });
  });
});

describe("direcciones Bitcoin inválidas", () => {
  const error = (raw: string, opts = main) => {
    const r = parseBtcAddress(raw, opts);
    return r.ok ? null : r.error;
  };

  it("rechaza un checksum alterado, en bech32 y en base58", () => {
    expect(error("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5")).toMatch(/no es válida/);
    expect(error("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3")).toMatch(/no es válida/);
  });

  it("rechaza mayúsculas y minúsculas mezcladas en bech32", () => {
    expect(error("bc1qW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toMatch(/no es válida/);
  });

  it("rechaza el checksum equivocado para la versión (bech32m en v0 y bech32 en v1)", () => {
    expect(error("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh")).toMatch(/no es válida/);
    expect(error("bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd")).toMatch(/no es válida/);
  });

  it("rechaza testnet cuando se cobra de verdad", () => {
    expect(error("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx")).toMatch(/red de pruebas/);
  });

  it("explica qué pasa con una dirección de Ethereum, una factura Lightning o un campo vacío", () => {
    expect(error("0x52908400098527886E0F7030069857D2E4169EE7")).toMatch(/Ethereum o BNB Chain/);
    expect(error("lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq")).toMatch(/Lightning/);
    expect(error("   ")).toBe("Escribe la dirección Bitcoin de destino.");
    expect(error("hola")).toMatch(/no es válida/);
  });
});
