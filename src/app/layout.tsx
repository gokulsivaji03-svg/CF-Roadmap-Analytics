import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"
import { Navbar } from "@/components/layout/navbar"

export const metadata: Metadata = {
  title: "CF Coach - Codeforces Training Platform",
  description:
    "Personalized Codeforces training platform that analyzes weaknesses, generates daily practice, and helps improve problem-solving skills.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-surface-dark">
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
