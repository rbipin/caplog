import { type ReactElement, type ReactNode, useState } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppConfigProvider } from '../app/AppConfigContext';

/** A QueryClient with retries/refetch disabled for deterministic tests. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Render a component inside a fresh QueryClient + AppConfigProvider.
 * Tests that touch the DB must mock `../db.js` themselves.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: { client?: QueryClient } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { client, ...rest } = options;
  function Wrapper({ children }: { children: ReactNode }) {
    const [qc] = useState(() => client ?? makeTestQueryClient());
    return (
      <QueryClientProvider client={qc}>
        <AppConfigProvider>{children}</AppConfigProvider>
      </QueryClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}
