'use client';

import { useEffect, useRef, useState } from 'react';
import LocalModelPicker from '@/app/_components/_sharedcomponents/LocalModelPicker';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { Alert, Box, Button, CircularProgress, Paper, Slider, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useUser } from '@/app/_contexts/User.context';

const controller = 'http://127.0.0.1:9501';

export default function PracticeClient() {
    const router = useRouter();
    const { user, anonymousUserId } = useUser();
    const { data: session } = useSession();
    const [deck, setDeck] = useState<'luke' | 'vader'>('luke');
    const [policy, setPolicy] = useState('learned');
    const [modelId, setModelId] = useState('current');
    const [delay, setDelay] = useState(1000);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;
        return () => {
            cancelledRef.current = true;
            socketRef.current?.disconnect();
        };
    }, []);

    const start = async () => {
        const identity = user ? { id: user.id, username: user.username } :
            anonymousUserId ? { id: anonymousUserId } : null;
        if (!identity) return;
        setBusy(true);
        setError('');
        setMessage('Preparing your opponent…');
        let sessionId: string | undefined;
        try {
            const previous = sessionStorage.getItem('labSessionId');
            if (previous) {
                await fetch(controller + '/sessions/' + previous, { method: 'DELETE' }).catch(() => undefined);
                sessionStorage.removeItem('labSessionId');
            }
            const response = await fetch(controller + '/sessions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ humanDeck: deck, delay, policy, modelId }),
                signal: AbortSignal.timeout(30000)
            });
            const setup = await response.json();
            if (!response.ok) throw new Error(setup.error || 'Could not prepare the bot.');
            sessionId = setup.id;
            if (cancelledRef.current) throw new Error('Practice setup cancelled.');
            sessionStorage.setItem('labSessionId', setup.id);
            setMessage('Joining the game…');
            const socket = io(setup.engineUrl, {
                path: '/ws', autoConnect: false,
                query: {
                    user: JSON.stringify(identity),
                    lobby: JSON.stringify({ lobbyId: setup.lobbyId }),
                    spectator: 'false'
                },
                auth: session?.jwtToken ? { token: session.jwtToken } : undefined
            });
            socketRef.current = socket;
            await new Promise<void>((resolve, reject) => {
                let loading = false;
                const timer = setTimeout(() => reject(new Error('The match did not start. Try again.')), 30000);
                const fail = (reason: unknown) => {
                    clearTimeout(timer);
                    reject(reason instanceof Error ? reason : new Error(String(reason)));
                };
                socket.on('connect_error', fail);
                socket.on('connection_error', fail);
                socket.on('gamestate', () => { clearTimeout(timer); resolve(); });
                socket.on('lobbystate', async (state: { users: { id: string }[] }) => {
                    if (loading || !state.users.some(player => player.id === identity.id)) return;
                    loading = true;
                    try {
                        const changed = await fetch(setup.engineUrl + '/api/lobby/' + setup.lobbyId + '/change-deck', {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user: identity, deck: setup.humanDeck }),
                            signal: AbortSignal.timeout(15000)
                        });
                        const result = await changed.json();
                        if (!changed.ok || !result.success || Object.keys(result.importDeckErrors ?? {}).length) {
                            throw new Error(result.error || 'The starter deck was rejected.');
                        }
                        setMessage('Starting the match…');
                        socket.emit('lobby', 'setReadyStatus', true);
                    } catch (reason) { fail(reason); }
                });
                socket.connect();
            });
            socket.disconnect();
            if (!cancelledRef.current) router.push('/GameBoard');
        } catch (reason) {
            socketRef.current?.disconnect();
            if (sessionId) await fetch(controller + '/sessions/' + sessionId, { method: 'DELETE' }).catch(() => undefined);
            sessionStorage.removeItem('labSessionId');
            setError(reason instanceof Error ? reason.message : 'Could not start local practice.');
            setBusy(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 760, mx: 'auto', px: 3, py: 6 }}>
            <Typography variant="overline" color="primary">LOCAL PRACTICE</Typography>
            <Typography variant="h3" component="h1" sx={{ mb: 2 }}>Play against a bot</Typography>
            <Typography sx={{ color: 'text.secondary', mb: 4 }}>
                Choose your Spark of Rebellion starter. Your opponent will play the other deck.
                Eternal · Best of one
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
                {(['luke', 'vader'] as const).map(name => (
                    <Paper key={name} variant="outlined" sx={{
                        p: 3, bgcolor: '#101b2b', borderColor: deck === name ? 'primary.main' : 'divider',
                        borderWidth: deck === name ? 2 : 1
                    }}>
                        <Typography variant="h5">{name === 'luke' ? 'Luke Skywalker' : 'Darth Vader'}</Typography>
                        <Typography sx={{ my: 2, color: 'text.secondary' }}>
                            {name === 'luke' ? 'Protect your Rebels with shields and healing.' :
                                'Command Imperial forces and overwhelm the opposition.'}
                        </Typography>
                        <Button variant={deck === name ? 'contained' : 'outlined'} disabled={busy}
                            aria-pressed={deck === name} onClick={() => setDeck(name)}>
                            {deck === name ? 'Selected' : 'Choose ' + (name === 'luke' ? 'Luke' : 'Vader')}
                        </Button>
                    </Paper>
                ))}
            </Box>
            <FormControl fullWidth sx={{ mb: 3 }} disabled={busy}>
                <InputLabel id="opponent-label">Opponent</InputLabel>
                <Select labelId="opponent-label" label="Opponent" value={policy} onChange={event => setPolicy(event.target.value)}>
                    <MenuItem value="learned">Learned model (experimental)</MenuItem>
                    <MenuItem value="scripted">Scripted bot</MenuItem>
                </Select>
            </FormControl>
            {policy === 'learned' && <LocalModelPicker controller={controller} value={modelId} onChange={setModelId} disabled={busy} />}
            <Typography id="bot-pace">Bot thinking time: {(delay / 1000).toFixed(1)} seconds</Typography>
            <Slider aria-labelledby="bot-pace" value={delay} min={250} max={2500} step={250}
                disabled={busy} onChange={(_, value) => setDelay(value as number)} sx={{ mb: 3 }} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button size="large" variant="contained" onClick={start}
                disabled={busy || (!user && !anonymousUserId)} startIcon={busy ? <CircularProgress size={18} /> : undefined}>
                {busy ? message : 'Start match'}
            </Button>
            <Button href="/watch" sx={{ ml: 2 }}>Watch two bots play</Button>
            <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary' }}>
                The learned model is experimental and uses rules for allocation choices. You can concede or request a rematch from the board.
            </Typography>
        </Box>
    );
}
