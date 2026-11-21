"use client";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

/**
 * Enlace a otro sitio (un explorador de bloques, por ejemplo) que se abre en una pestaña nueva. El navegador interno
 * de muchas apps ignora target="_blank" y window.open no abre nada: en ese caso el enlace se abre en la misma
 * pestaña en vez de quedarse quieto. Los clics con Ctrl, ⌘, Shift, Alt o el botón del medio siguen en manos del
 * navegador, como en cualquier enlace.
 */
export function OutboundLink({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const tab = window.open(href, "_blank");
    if (tab) tab.opener = null;
    else window.location.assign(href);
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props} onClick={open}>
      {children}
    </a>
  );
}
