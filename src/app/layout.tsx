import type { Metadata } from "next"
import "./globals.css"
import { Nav } from "@/components/nav"

export const metadata: Metadata = {
  title: "Cricket Tournament Scheduler",
  description: "Multi-format cricket tournament management and scheduling",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  )
}
