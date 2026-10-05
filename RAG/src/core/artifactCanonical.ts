/** Stable JSON representation shared by server/browser hashing. */
export function canonicalJSON(value: unknown): string {
    if (value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJSON(item)}`).join(',')}}`;
    return JSON.stringify(value);
}
