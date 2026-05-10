import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
    deleteApiKey: vi.fn(),
    listModelConfigDependencies: vi.fn(),
    getActiveModelConfigId: vi.fn(),
}));

import * as db from '@/lib/db';
import { DeleteApiKeyDialog } from './DeleteApiKeyDialog';

const apiKey = {
    id: 'key-1',
    providerId: 'openai',
    nickname: 'Personal',
    createdAt: '2026-05-09',
};

beforeEach(() => {
    vi.mocked(db.deleteApiKey).mockReset();
    vi.mocked(db.listModelConfigDependencies).mockReset();
    vi.mocked(db.getActiveModelConfigId).mockReset();
});

describe('<DeleteApiKeyDialog />', () => {
    it('lists dependent model configs', async () => {
        vi.mocked(db.listModelConfigDependencies).mockResolvedValueOnce([
            {
                id: 'mc-1',
                apiKeyId: 'key-1',
                modelId: 'whisper-1',
                providerId: 'openai',
                apiKeyNickname: 'Personal',
            },
        ]);
        vi.mocked(db.getActiveModelConfigId).mockResolvedValueOnce(null);
        render(<DeleteApiKeyDialog apiKey={apiKey} onClose={vi.fn()} onDeleted={vi.fn()} />);
        const list = await screen.findByTestId('dependent-list');
        expect(list).toHaveTextContent('whisper-1');
        expect(screen.queryByTestId('active-warning')).toBeNull();
    });

    it('shows the active warning when one of the dependents is active', async () => {
        vi.mocked(db.listModelConfigDependencies).mockResolvedValueOnce([
            {
                id: 'mc-1',
                apiKeyId: 'key-1',
                modelId: 'whisper-1',
                providerId: 'openai',
                apiKeyNickname: 'Personal',
            },
        ]);
        vi.mocked(db.getActiveModelConfigId).mockResolvedValueOnce('mc-1');
        render(<DeleteApiKeyDialog apiKey={apiKey} onClose={vi.fn()} onDeleted={vi.fn()} />);
        expect(await screen.findByTestId('active-warning')).toBeInTheDocument();
    });

    it('calls deleteApiKey when confirmed and notifies via onDeleted', async () => {
        vi.mocked(db.listModelConfigDependencies).mockResolvedValueOnce([]);
        vi.mocked(db.getActiveModelConfigId).mockResolvedValueOnce(null);
        const onDeleted = vi.fn();
        const user = userEvent.setup();
        render(<DeleteApiKeyDialog apiKey={apiKey} onClose={vi.fn()} onDeleted={onDeleted} />);
        await user.click(await screen.findByTestId('confirm-delete'));
        await waitFor(() => {
            expect(db.deleteApiKey).toHaveBeenCalledWith('key-1');
            expect(onDeleted).toHaveBeenCalled();
        });
    });
});
