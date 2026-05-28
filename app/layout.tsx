import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SmartPOS — Tiendas Online',
  description: 'Tu tienda online, sin complicaciones.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
