"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted
    ? (theme === "system" ? resolvedTheme === "dark" : theme === "dark") ?? false
    : false;
  const label = mounted
    ? isDark
      ? "Alternar para tema claro"
      : "Alternar para tema escuro"
    : "Alternar tema";

  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {mounted ? (
        isDark ? (
          <Moon size={16} strokeWidth={2} />
        ) : (
          <Sun size={16} strokeWidth={2} />
        )
      ) : (
        <Sun size={16} strokeWidth={2} />
      )}
    </button>
  );
}
