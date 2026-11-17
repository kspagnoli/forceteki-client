export function localModelLabel(id?: string): string {
    const labels: Record<string, string> = {
        original: 'Original pilot',
        'targeting-v2': 'Targeting corrected',
        'tempo-v3': 'Luke tempo candidate'
    };
    return labels[id ?? ''] ?? 'Learned model';
}
