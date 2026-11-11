"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const current = (href: string) =>
    href === "/orders"
      ? path === "/orders" || (path.startsWith("/orders/") && !path.startsWith("/orders/new"))
      : path.startsWith(href);

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current(item.href) ? "page" : undefined}
          className={`rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
            current(item.href) ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
