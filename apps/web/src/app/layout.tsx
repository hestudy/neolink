import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { DevAuthSetup } from '@/components/DevAuthSetup';
import { Toaster } from '@/lib/toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NeoLink - AI-Powered Link Management',
  description: 'Intelligent link management platform powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <DevAuthSetup />
        <ErrorBoundary>
          <Layout>{children}</Layout>
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
