export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
