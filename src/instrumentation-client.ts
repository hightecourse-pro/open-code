// Runs in the browser before any page code (Next's instrumentation-client convention).
//
// The conference tablets (25.11): a Lenovo TB-X505L on Android 10 with Chrome 81 showed המסע לאי השפיות as a bare
// sky - the bundle's 2020+ syntax threw `SyntaxError: Unexpected token '='` on line 1 and nothing ran. The
// browserslist in package.json now lowers the syntax to Chrome 80; this file fills the few APIs such a browser
// lacks (the diagnostics page listed them). Every fill is guarded - a current browser never touches them.
/* eslint-disable @typescript-eslint/no-explicit-any */
const A = Array.prototype as any;
if (!A.at) {
  A.at = function (this: unknown[], n: number) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    return n < 0 || n >= this.length ? undefined : this[n];
  };
}
if (!A.findLast) {
  A.findLast = function (this: unknown[], f: (v: unknown, i: number, a: unknown[]) => unknown) {
    for (let i = this.length - 1; i >= 0; i--) if (f(this[i], i, this)) return this[i];
    return undefined;
  };
}
if (!A.findLastIndex) {
  A.findLastIndex = function (this: unknown[], f: (v: unknown, i: number, a: unknown[]) => unknown) {
    for (let i = this.length - 1; i >= 0; i--) if (f(this[i], i, this)) return i;
    return -1;
  };
}
if (!A.toSorted) A.toSorted = function (this: unknown[], c?: (a: unknown, b: unknown) => number) { return this.slice().sort(c); };
if (!A.toReversed) A.toReversed = function (this: unknown[]) { return this.slice().reverse(); };

const O = Object as any;
if (!O.hasOwn) O.hasOwn = (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k);

const S = String.prototype as any;
if (!S.replaceAll) {
  S.replaceAll = function (this: string, a: string | RegExp, b: any) {
    return typeof a === "string" ? this.split(a).join(typeof b === "function" ? b(a) : b) : this.replace(a, b);
  };
}

const G = globalThis as any;
if (typeof G.structuredClone !== "function") G.structuredClone = (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
if (G.crypto && typeof G.crypto.randomUUID !== "function") {
  G.crypto.randomUUID = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
}

export {};
