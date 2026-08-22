import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'EXACT — Time precision game',
  description: 'Test how precisely you can feel the passage of time.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
