"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (theme === "system" ? resolvedTheme === "dark" : theme === "dark") ?? false;
  const label = isDark ? "Alternar para tema claro" : "Alternar para tema escuro";

  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {mounted ? (isDark ? "🌙 Escuro" : "☀️ Claro") : "Tema"}
    </button>
  );
}
