// Client-safe bits of the hackathon module (no server-only imports).
export interface MaterialRow {
  id: string;
  challenge_key: string;
  title: string;
  file_path: string;
  size_bytes: number | null;
  created_at: string;
}

export function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
