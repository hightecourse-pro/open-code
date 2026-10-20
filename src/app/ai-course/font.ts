import localFont from "next/font/local";

// The same self-hosted Rubik the masters-course pages use (one copy in the
// repo; no build-time font fetch).
export const rubik = localFont({ src: "../masters-course/fonts/Rubik-Variable.ttf", weight: "300 900", display: "swap" });
