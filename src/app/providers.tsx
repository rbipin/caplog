import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppConfigProvider } from './AppConfigContext';

/** A QueryClient tuned for a fast local SQLite store: invalidate-driven refresh. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <AppConfigProvider>{children}</AppConfigProvider>
    </QueryClientProvider>
  );
}
