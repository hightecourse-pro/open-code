/** Shared by the server (sheet → rows) and the browser (the desk) of מערכת הדפסת תגים. */

/** One participant: her cells keyed by the sheet's own headers (only the desk columns), and her 1-based sheet row. */
export interface Participant {
  cols: Record<string, string>;
  row: number;
}

export interface DymoStatus {
  isReady: boolean;
  message: string;
}
