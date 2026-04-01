import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'NovaBiz OS — AI Executive Team for Small Business',
  description: 'The AI operating system that runs your business autonomously.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
