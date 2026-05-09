import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsProviders } from './SettingsProviders';

describe('<SettingsProviders />', () => {
    it('renders one card per known provider', () => {
        render(<SettingsProviders />);
        expect(screen.getByTestId('provider-card-openai')).toBeInTheDocument();
        expect(screen.getByTestId('provider-card-groq')).toBeInTheDocument();
        expect(screen.getByTestId('provider-card-deepgram')).toBeInTheDocument();
        expect(screen.getByTestId('provider-card-assemblyai')).toBeInTheDocument();
    });

    it('exposes an API-key input, a model select, and an active toggle for each card', () => {
        render(<SettingsProviders />);
        const card = screen.getByTestId('provider-card-openai');
        expect(card.querySelector('input[type="password"]')).not.toBeNull();
        expect(card.querySelector('select')).not.toBeNull();
        expect(card.querySelector('button[role="switch"]')).not.toBeNull();
    });

    it('invokes onSaveKey with the providerId and entered key when Save is clicked', async () => {
        const onSaveKey = vi.fn();
        const user = userEvent.setup();
        render(<SettingsProviders onSaveKey={onSaveKey} />);
        const card = screen.getByTestId('provider-card-openai');
        const input = card.querySelector('input[type="password"]') as HTMLInputElement;
        await user.type(input, 'sk-test');
        await user.click(card.querySelector('button[data-action="save"]') as HTMLButtonElement);
        expect(onSaveKey).toHaveBeenCalledWith('openai', 'sk-test');
    });
});
