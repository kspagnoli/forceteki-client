'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { localModelLabel } from '@/app/_components/_sharedcomponents/localModelLabel';
import { useRouter } from 'next/navigation';
import { useGame } from '@/app/_contexts/Game.context';

type BotStatus = { model?: { candidateId?: string }; policy?: string; status: string; paused: boolean; decisions: number; message?: string };

export default function LocalBotStatus() {
    const router = useRouter();
    const { gameState, sendGameMessage } = useGame();
    const [newMatchRequested, setNewMatchRequested] = useState(false);
    const [id, setId] = useState<string | null>(null);
    const [status, setStatus] = useState<BotStatus | null>(null);
    const [offline, setOffline] = useState(false);
    useEffect(() => {
        const sessionId = sessionStorage.getItem('labSessionId');
        setId(sessionId);
        if (!sessionId) return;
        let active = true;
        const update = async () => {
            try {
                const response = await fetch('http://127.0.0.1:9501/sessions/' + sessionId);
                if (!response.ok) throw new Error('Bot session unavailable');
                const next = await response.json();
                if (active) { setStatus(next); setOffline(false); }
            } catch {
                if (active) setOffline(true);
            }
        };
        update();
        const timer = setInterval(update, 2000);
        return () => { active = false; clearInterval(timer); };
    }, []);
    useEffect(() => {
        if (newMatchRequested && gameState?.winners?.length) router.push('/practice');
    }, [newMatchRequested, gameState?.winners?.length, router]);
    const newMatch = () => {
        if (gameState?.winners?.length) router.push('/practice');
        else { setNewMatchRequested(true); sendGameMessage(['concede']); }
    };
    const toggle = async () => {
        if (!id || !status) return;
        try {
            const response = await fetch('http://127.0.0.1:9501/sessions/' + id, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: status.paused ? 'resume' : 'pause' })
            });
            if (!response.ok) throw new Error('Bot session unavailable');
            setStatus(await response.json());
        } catch { setOffline(true); }
    };
    if (!id || (!status && !offline)) return null;
    return (
        <Box role="status" sx={{
            position: 'fixed', top: 64, right: 12, zIndex: 1250,
            bgcolor: 'rgba(12,18,28,0.92)', color: 'white', borderRadius: 1, px: 1.5, py: 0.75,
            display: 'flex', alignItems: 'center', gap: 1
        }}>
            <Typography variant="caption">
                {offline ? 'Bot connection unavailable' : status?.paused ? 'Bot paused' :
                    status?.status === 'ended' ? 'Practice finished' : status?.policy === 'learned' ? localModelLabel(status.model?.candidateId) : 'Scripted bot'}
            </Typography>
            {!offline && status?.status !== 'ended' &&
                <Button size="small" onClick={toggle}>{status?.paused ? 'Resume' : 'Pause'}</Button>}
            <Button size="small" onClick={newMatch} disabled={newMatchRequested}>
                {gameState?.winners?.length ? 'New match' : 'End & new match'}
            </Button>
        </Box>
    );
}
