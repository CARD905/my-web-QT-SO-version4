import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'WISDOM — Quotation System',
  description: 'Quotation & Sale Order Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${sarabun.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}