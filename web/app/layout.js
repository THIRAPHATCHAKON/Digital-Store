import { Suspense } from 'react';
import { StoreProvider } from '../lib/store';
import './globals.css';

export const metadata = { title: 'Digital Store — ร้านสินค้าดิจิทัล' };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* Pages read useSearchParams(); Next needs a Suspense boundary above them. It wraps the provider
            too, so the provider's first fetches can't change the context before its children hydrate. */}
        <Suspense>
          <StoreProvider>{children}</StoreProvider>
        </Suspense>
      </body>
    </html>
  );
}
