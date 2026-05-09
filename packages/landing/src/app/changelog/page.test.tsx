import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChangelogPage from './page';

vi.mock('@/lib/github', () => ({
    fetchReleases: vi.fn(async () => []),
}));

describe('Changelog page', () => {
    it('renders empty state when no releases', async () => {
        const Page = await ChangelogPage();
        render(Page);
        expect(screen.getByText(/no releases yet/i)).toBeInTheDocument();
    });
});
