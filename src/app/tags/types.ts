/** Shared by the server (sheet → rows) and the browser (the desk) of מערכת הדפסת תגים. */

/** One participant: her cells keyed by the sheet's own headers (only the desk columns), and her 1-based sheet row. */
export interface Participant {
  cols: Record<string, string>;
  row: number;
}

/** A printer as DYMO Web Service lists it. */
export interface DymoPrinter {
  /** The Windows printer name - what PrintLabel is addressed to. */
  name: string;
  model: string;
  /** DYMO sees it plugged in right now. */
  connected: boolean;
  labelWriter: boolean;
}

export interface DymoStatus {
  isReady: boolean;
  message: string;
  printers: DymoPrinter[];
  /** The printer we will print on (chosen by the person, or the first connected LabelWriter). */
  printer?: string;
  /** What DYMO actually answered (GetPrinters' XML) - shown under ״פרטים טכניים״ so a stuck desk can be diagnosed from a screenshot. */
  detail?: string;
}
