import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { openUrlMock } = vi.hoisted(() => ({ openUrlMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: openUrlMock }));

import { Markdown } from '../../components/Markdown';

beforeEach(() => vi.clearAllMocks());

describe('Markdown (security)', () => {
  it('renders an injected <script> tag inert (as text, no script element)', () => {
    const { container } = render(<Markdown>{'Hello <script>alert(1)</script>'}</Markdown>);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('alert(1)');
  });

  it('does not render an <img onerror> vector as an element', () => {
    const { container } = render(<Markdown>{'<img src=x onerror=alert(1)>'}</Markdown>);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('Markdown (rendering)', () => {
  it('renders bullet lists as <ul><li>', () => {
    const { container } = render(<Markdown>{'- one\n- two'}</Markdown>);
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders **bold** as <strong>', () => {
    const { container } = render(<Markdown>{'**hi**'}</Markdown>);
    expect(container.querySelector('strong')?.textContent).toBe('hi');
  });

  it('inline mode unwraps the outer paragraph (no <p>)', () => {
    const { container } = render(<Markdown inline>{'just text'}</Markdown>);
    expect(container.querySelector('p')).toBeNull();
    expect(container.textContent).toContain('just text');
  });

  it('opens links via the system browser (openUrl) instead of navigating', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<Markdown>{'[link](https://example.com)'}</Markdown>);
    await user.click(screen.getByText('link'));
    expect(openUrlMock).toHaveBeenCalledWith('https://example.com');
  });
});
