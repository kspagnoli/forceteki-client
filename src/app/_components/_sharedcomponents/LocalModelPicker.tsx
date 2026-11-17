'use client';

import { useEffect, useState } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

type Model = { id: string; label: string };
type Props = { controller: string; value: string; onChange: (value: string) => void; disabled: boolean };

export default function LocalModelPicker({ controller, value, onChange, disabled }: Props) {
    const [models, setModels] = useState<Model[]>([{ id: 'current', label: 'Current model' }]);
    useEffect(() => {
        const abort = new AbortController();
        fetch(controller + '/models', { signal: abort.signal, cache: 'no-store' })
            .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
            .then(next => { if (!abort.signal.aborted) setModels(next); })
            .catch(() => {});
        return () => abort.abort();
    }, [controller]);
    return (
        <FormControl fullWidth sx={{ mb: 3 }} disabled={disabled}>
            <InputLabel id="model-version-label">Model version</InputLabel>
            <Select labelId="model-version-label" label="Model version" value={value}
                onChange={event => onChange(event.target.value)}>
                {models.map(model => <MenuItem key={model.id} value={model.id}>{model.label}</MenuItem>)}
            </Select>
        </FormControl>
    );
}
