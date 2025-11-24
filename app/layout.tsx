import './globals.css'

export const metadata = {
  title: 'Shubham Advertise - Hoarding Management',
  description: 'Centralized hoarding management and sales platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

