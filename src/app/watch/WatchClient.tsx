'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Paper, Slider, Typography } from '@mui/material';
import { useUser } from '@/app/_contexts/User.context';

const controller = 'http://127.0.0.1:9502';

export default function WatchClient() {
    const router = useRouter();
    const { user, anonymousUserId } = useUser();
    const [delay, setDelay] = useState(1000);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const start = async () => {
        setBusy(true); setError('');
        try {
            const previous = sessionStorage.getItem('labWatchSessionId');
            if (previous) {
                await fetch(controller + '/sessions/' + previous, { method: 'DELETE' });
                sessionStorage.removeItem('labWatchSessionId');
            }
            const response = await fetch(controller + '/sessions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delay }), signal: AbortSignal.timeout(45000)
            });
            const setup = await response.json();
            if (!response.ok) throw new Error(setup.error || 'Could not prepare the match.');
            sessionStorage.setItem('labWatchSessionId', setup.id);
            router.push('/spectate?lobbyId=' + encodeURIComponent(setup.lobbyId));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not start the match.');
            setBusy(false);
        }
    };
    return (
        <Box sx={{ maxWidth: 760, mx: 'auto', px: 3, py: 6 }}>
            <Typography variant="overline" color="primary">LOCAL SPECTATOR</Typography>
            <Typography variant="h3" component="h1" sx={{ mb: 2 }}>Watch two bots play</Typography>
            <Typography sx={{ color: 'text.secondary', mb: 3 }}>
                Watch the same starter bot play both sides of an Eternal, best-of-one match.
            </Typography>
            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5">Luke Skywalker vs Darth Vader</Typography>
                <Typography sx={{ mt: 1 }}>Original Spark of Rebellion starters</Typography>
                <Typography sx={{ mt: 2, color: 'text.secondary' }}>
                    The board opens paused. Press Play when you are ready; pause or change speed at any time.
                </Typography>
            </Paper>
            <Typography id="watch-pace">Time per decision: {(delay / 1000).toFixed(2)} seconds</Typography>
            <Slider aria-labelledby="watch-pace" value={delay} min={250} max={2500} step={250}
                disabled={busy} onChange={(_, value) => setDelay(value as number)} sx={{ mb: 3 }} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button variant="contained" size="large" disabled={busy || (!user && !anonymousUserId)}
                onClick={start} startIcon={busy ? <CircularProgress size={18} /> : undefined}>
                {busy ? 'Preparing match…' : 'Watch match'}
            </Button>
            <Button href="/practice" sx={{ ml: 2 }}>Play against a bot</Button>
        </Box>
    );
}
