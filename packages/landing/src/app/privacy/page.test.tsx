import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from './page';

describe('Privacy page', () => {
    it('mentions all three OS keychains', () => {
        render(<PrivacyPage />);
        expect(screen.getAllByText(/Keychain/).length).toBeGreaterThan(0);
        expect(screen.getByText(/Credential Manager/)).toBeInTheDocument();
        expect(screen.getByText(/Secret Service/)).toBeInTheDocument();
    });

    it('declares zero telemetry', () => {
        render(<PrivacyPage />);
        expect(screen.getByText(/zero telemetry/i)).toBeInTheDocument();
    });
});
