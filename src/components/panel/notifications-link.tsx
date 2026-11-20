"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useNotices } from "./use-notices";

export function NotificationsLink() {
  const { unread } = useNotices();
  return (
    <Link
      href="/panel/avisos"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong text-fog transition-colors hover:border-fog hover:text-ink"
      aria-label={unread ? `Avisos: ${unread} sin leer` : "Mis avisos"}
    >
      <Bell size={17} />
      {unread > 0 && (
        <span
          className="num absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-amber px-1 text-center text-[0.62rem] leading-[18px] text-amber-ink"
          aria-hidden="true"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
