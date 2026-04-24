import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cadastre Prospect',
  description: 'Outil de prospection parcellaire',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full overflow-hidden bg-bg text-text">{children}</body>
    </html>
  );
}
