// The QR codes of the tablets' addresses (the studio's ״QR״ button and the printable sheet, 25.11). The generator is
// qrcode-generator 1.4.4 (MIT, public/sanity/qrcode.min.js, a browser global) loaded the first time a code is needed.
export type QrLib = (typeNumber: number, level: string) => { addData(s: string): void; make(): void; createSvgTag(o: { scalable?: boolean; margin?: number }): string };

declare global {
  interface Window {
    qrcode?: QrLib;
  }
}

let loading: Promise<QrLib> | null = null;

export function loadQr(): Promise<QrLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/sanity/qrcode.min.js";
      s.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error("qrcode missing")));
      s.onerror = () => reject(new Error("qrcode failed to load"));
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** An SVG (scalable, no quiet zone - the caller pads) of `text`. */
export function qrSvg(lib: QrLib, text: string): string {
  const q = lib(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ scalable: true, margin: 0 });
}
