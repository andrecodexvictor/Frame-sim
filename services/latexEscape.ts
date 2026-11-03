const special: Record<string, string> = { '%': '\\%', '_': '\\_', '&': '\\&', '#': '\\#', '$': '\\$', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}', '\\': '\\textbackslash{}' };
/** One pass: generated escape sequences are never escaped again. */
export function latexEscape(value: unknown): string {
    return Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ')).map(character => special[character] ?? character).join('');
}
export const csvCell = (value: unknown): string => value === null || value === undefined ? '' : `"${String(value).replace(/"/g, '""')}"`;
