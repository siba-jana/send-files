"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Theme toggle shared by the site header and the landing-page navs.
 *
 * On mount it applies the persisted (or system) theme — mirroring the
 * layout's pre-paint bootstrap (localStorage "theme" + `.dark`) so both
 * stay in sync. Every click flips and persists the choice.
 */
export function ThemeToggle({ className }: { className?: string }) {
  React.useEffect(() => {
    const stored = window.localStorage.getItem("theme")
    const dark =
      stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
  }, [])

  const toggleTheme = () => {
    const dark = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.style.colorScheme = dark ? "dark" : "light"
    window.localStorage.setItem("theme", dark ? "dark" : "light")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={cn(
        "relative size-11 text-muted-foreground hover:text-foreground md:size-9",
        className
      )}
    >
      <Sun
        aria-hidden="true"
        className="size-5 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        aria-hidden="true"
        className="absolute size-5 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100"
      />
    </Button>
  )
}
