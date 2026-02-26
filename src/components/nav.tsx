"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Tournaments" },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-6 border-b px-6 py-3 bg-card">
      <Link href="/" className="text-lg font-semibold mr-4">
        Cricket Scheduler
      </Link>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-sm transition-colors hover:text-foreground",
            pathname === item.href
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export function TournamentNav({ tournamentId }: { tournamentId: string }) {
  const pathname = usePathname()
  const base = `/tournaments/${tournamentId}`

  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/divisions`, label: "Divisions" },
    { href: `${base}/conflicts`, label: "Conflicts" },
    { href: `${base}/grounds`, label: "Grounds" },
    { href: `${base}/game-days`, label: "Game Days" },
    { href: `${base}/import`, label: "Teams" },
    { href: `${base}/schedule`, label: "Schedule" },
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/knockout`, label: "Knockout" },
    { href: `${base}/umpires`, label: "Umpires" },
  ]

  return (
    <nav className="flex items-center gap-4 border-b px-6 py-2 bg-muted/50">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-sm transition-colors hover:text-foreground",
            pathname === item.href
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
