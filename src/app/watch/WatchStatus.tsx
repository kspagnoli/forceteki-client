'use client';

import { useEffect, useState } from 'react';
import { localModelLabel } from '@/app/_components/_sharedcomponents/localModelLabel';
import { useRouter } from 'next/navigation';
import { Box, Button, Slider, Typography } from '@mui/material';

type WatchState = {
    status: string; message?: string; delay: number; model?: { candidateId?: string };
    bots: { deck: string; policy?: string; decisions: number; lastDecision: { reason: string } | null }[];
};
const controller = 'http://127.0.0.1:9502/sessions/';

export default function WatchStatus() {
    const router = useRouter();
    const [id, setId] = useState<string | null>(null);
    const [state, setState] = useState<WatchState | null>(null);
    const [pace, setPace] = useState(1000);
    const [error, setError] = useState('');
    useEffect(() => {
        const sessionId = sessionStorage.getItem('labWatchSessionId');
        if (!sessionId) return;
        setId(sessionId);
        let active = true;
        const update = async () => {
            try {
                const response = await fetch(controller + sessionId);
                if (!response.ok) throw new Error('Watch controls unavailable.');
                const next = await response.json();
                if (active) { setState(next); setError(''); }
            } catch { if (active) setError('Watch controls unavailable.'); }
        };
        update();
        const timer = setInterval(update, 750);
        return () => { active = false; clearInterval(timer); };
    }, []);
    const serverDelay = state?.delay;
    useEffect(() => { if (serverDelay !== undefined) setPace(serverDelay); }, [serverDelay]);
    const action = async (body: object) => {
        try {
            const response = await fetch(controller + id, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('Watch controls unavailable.');
            setState(await response.json()); setError('');
        } catch { setError('Watch controls unavailable.'); }
    };
    const newMatch = async () => {
        try {
            const response = await fetch(controller + id, { method: 'DELETE' });
            if (!response.ok && response.status !== 404) throw new Error('Could not close the match.');
            sessionStorage.removeItem('labWatchSessionId');
            router.push('/watch');
        } catch { setError('Could not close the match. Try again.'); }
    };
    if (!id) return null;
    return (
        <Box aria-label="Bot match controls" sx={{
            position: 'fixed', top: 64, right: 12, zIndex: 1250, width: 254,
            bgcolor: 'rgba(12,18,28,0.95)', color: 'white', borderRadius: 1, p: 1.5
        }}>
            <Typography variant="subtitle2">Luke vs Vader · {state?.status ?? 'connecting'}</Typography>
            {state?.bots.some(bot => bot.policy === 'learned') && <Typography variant="caption" component="p">{localModelLabel(state.model?.candidateId)}</Typography>}
            {state && <Box sx={{ display: 'flex', gap: 1, my: 0.5 }}>
                {state.status !== 'ended' && <Button size="small" variant="outlined"
                    onClick={() => action({ action: state.status === 'playing' ? 'pause' : 'resume' })}>
                    {state.status === 'playing' ? 'Pause' : 'Play'}
                </Button>}
                <Button size="small" onClick={newMatch}>New match</Button>
            </Box>}
            <Typography variant="caption">Time per decision: {(pace / 1000).toFixed(2)}s</Typography>
            <Slider aria-label="Watch speed" value={pace} min={250} max={2500} step={250}
                onChange={(_, value) => setPace(value as number)}
                onChangeCommitted={(_, value) => action({ action: 'pace', delay: value })}
                disabled={!state || state.status === 'ended'} size="small" />
            {state?.bots.map(bot => <Typography key={bot.deck} variant="caption" component="p" sx={{ mb: 0.5 }}>
                <strong>{bot.deck === 'luke' ? 'Luke' : 'Vader'} · {bot.policy ?? 'scripted'} ({bot.decisions}): </strong>
                {bot.lastDecision?.reason ?? 'Waiting to begin'}
            </Typography>)}
            {(error || state?.message) && <Typography variant="caption" component="p">{error || state?.message}</Typography>}
        </Box>
    );
}
