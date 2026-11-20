"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { THEMES } from "@/lib/theme";

/** Cambia entre el tema oscuro (basalto) y el claro. */
export function ThemeSelector() {
  const { mode, setMode } = useTheme();
  const next = mode === "dark" ? "light" : "dark";
  const Icon = mode === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      className="btn btn-ghost min-w-11 px-2.5 py-2"
      aria-label={`Tema ${THEMES[mode].label.toLowerCase()}. Cambiar a ${THEMES[next].label.toLowerCase()}`}
      title={`Cambiar a tema ${THEMES[next].label.toLowerCase()}`}
      onClick={() => setMode(next)}
    >
      <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
    </button>
  );
}
