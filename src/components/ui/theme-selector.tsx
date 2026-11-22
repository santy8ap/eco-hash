"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import { readTheme } from "@/lib/theme";

/**
 * Cambia entre el tema oscuro (basalto) y el claro. El ícono y el nombre accesible no salen del estado de React sino
 * del atributo data-theme de <html>, con CSS (.when-dark / .when-light): así son los correctos desde el primer
 * pintado, antes de hidratar, y el HTML del servidor coincide siempre con el del navegador, también dentro de un
 * Suspense que se hidrata después (el panel y el admin).
 */
export function ThemeSelector() {
  const { setMode } = useTheme();
  return (
    <button
      type="button"
      className="btn btn-ghost min-w-11 px-2.5 py-2"
      onClick={() => setMode(readTheme(document.documentElement.dataset.theme) === "dark" ? "light" : "dark")}
    >
      <span className="when-dark sr-only">Tema oscuro. Cambiar a claro</span>
      <span className="when-light sr-only">Tema claro. Cambiar a oscuro</span>
      <Moon className="when-dark" aria-hidden="true" size={17} strokeWidth={1.7} />
      <Sun className="when-light" aria-hidden="true" size={17} strokeWidth={1.7} />
    </button>
  );
}
