// Full SMTP send test against Resend — verifies auth + real delivery.
//   put RESEND_API_KEY=... in .env.local, then:
//   node --env-file=.env.local scripts/test-resend-smtp.mjs
import net from "node:net";
import tls from "node:tls";

const HOST = "smtp.resend.com";
const PORT = 587;
const USER = "resend";
const PASS = process.env.RESEND_API_KEY || "";
const FROM = process.env.MAIL_FROM || "noreply@opencode.org.il";
const TO = process.env.MAIL_TO || "office@opencode.org.il";

if (!PASS) {
  console.error("Missing RESEND_API_KEY in .env.local");
  process.exit(1);
}

function makeReader(sock) {
  let buf = "";
  let waiter = null;
  sock.on("data", (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    const last = lines[lines.length - 2];
    if (last && /^\d{3} /.test(last) && waiter) {
      const reply = buf;
      buf = "";
      const w = waiter;
      waiter = null;
      w(reply);
    }
  });
  return () => new Promise((res) => (waiter = res));
}
async function cmd(sock, read, line, expect, label) {
  if (line) sock.write(line + "\r\n");
  const reply = await read();
  const code = parseInt(reply, 10);
  console.log(`  ${label ?? line} → ${reply.trim().split(/\r?\n/).pop()}`);
  if (expect && code !== expect) throw new Error(`FAILED at "${label ?? line}": expected ${expect}, got ${code}`);
  return code;
}

const plain = net.connect(PORT, HOST);
let read = makeReader(plain);
await cmd(plain, read, null, 220, "connect");
await cmd(plain, read, "EHLO opencode.org.il", 250, "EHLO");
await cmd(plain, read, "STARTTLS", 220, "STARTTLS");
const secure = tls.connect({ socket: plain, servername: HOST });
await new Promise((r) => secure.once("secureConnect", r));
read = makeReader(secure);
await cmd(secure, read, "EHLO opencode.org.il", 250, "EHLO(tls)");
await cmd(secure, read, "AUTH LOGIN", 334, "AUTH LOGIN");
await cmd(secure, read, Buffer.from(USER).toString("base64"), 334, "username");
await cmd(secure, read, Buffer.from(PASS).toString("base64"), 235, "password (auth)");
await cmd(secure, read, `MAIL FROM:<${FROM}>`, 250, "MAIL FROM");
await cmd(secure, read, `RCPT TO:<${TO}>`, 250, "RCPT TO");
await cmd(secure, read, "DATA", 354, "DATA");
const msg = [
  `From: =?UTF-8?B?${Buffer.from("קוד פתוח").toString("base64")}?= <${FROM}>`,
  `To: ${TO}`,
  `Subject: =?UTF-8?B?${Buffer.from("בדיקת Resend — קוד פתוח").toString("base64")}?=`,
  `Content-Type: text/plain; charset=UTF-8`,
  ``,
  `Resend SMTP test. If this arrived, email works end-to-end.`,
].join("\r\n");
secure.write(msg + "\r\n.\r\n");
const finalReply = await read();
console.log(`  DATA send → ${finalReply.trim().split(/\r?\n/).pop()}`);
secure.write("QUIT\r\n");
console.log(/^250/.test(finalReply) ? `\n✅ FULL SEND accepted — real email sent to ${TO}.` : `\n❌ Send rejected.`);
process.exit(0);
