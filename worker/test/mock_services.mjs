// Imitations locales de GitHub (API contents), Stripe (Checkout) et Resend pour les tests. node test/mock_services.mjs 9922
import http from "node:http";
const files = new Map(); // chemin -> { sha, content (base64) }
let n = 0;
const calls = [];
const sha = () => "sha" + (++n).toString(16).padStart(6, "0");
files.set("content/portfolio.json", { sha: sha(), content: Buffer.from(JSON.stringify({ chapters: [{ id: "soirees", name: { fr: "La nuit", en: "Nightlife" }, projects: [{ id: "bashment", title: "The Bashment", eds: [{ year: "2025", imgs: [1, 2, 3] }] }] }] })).toString("base64") });
files.set("content/home.json", { sha: sha(), content: Buffer.from(JSON.stringify({ hero: [4], about: [5], wall: [6], me: 7, heroLab: {}, cap: {} })).toString("base64") });
files.set("content/site.json", { sha: sha(), content: Buffer.from(JSON.stringify({ email: "baeypro@gmail.com", api: "" })).toString("base64") });
// MOCK_CONTENT=<dossier> : sert les vrais fichiers content/*.json (essai de l'éditeur du portfolio dans le navigateur).
if (process.env.MOCK_CONTENT) for (const f of ["portfolio", "home", "site"]) files.set(`content/${f}.json`, { sha: sha(), content: (await import("node:fs")).readFileSync(`${process.env.MOCK_CONTENT}/${f}.json`).toString("base64") });
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString();
  const u = new URL(req.url, "http://x");
  calls.push({ method: req.method, path: u.pathname, auth: req.headers.authorization || "", body: body.slice(0, 4000) });
  const send = (st, obj) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (u.pathname === "/") return send(200, { calls });
  let m = /^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/.exec(u.pathname);
  if (m) {
    if (!/^Bearer gh_test/.test(req.headers.authorization || "")) return send(401, { message: "Bad credentials" });
    const f = files.get(m[1]);
    if (req.method === "GET") return f ? send(200, { sha: f.sha, encoding: "base64", content: f.content }) : send(404, {});
    if (req.method === "PUT") {
      const b = JSON.parse(body);
      if (!f || b.sha !== f.sha) return send(409, { message: "sha mismatch" });
      const nf = { sha: sha(), content: b.content }; files.set(m[1], nf);
      return send(200, { content: { sha: nf.sha }, commit: { sha: "c" + nf.sha } });
    }
  }
  if (u.pathname === "/v1/checkout/sessions" && req.method === "POST") {
    if (!/^Bearer sk_test/.test(req.headers.authorization || "")) return send(401, { error: { message: "Invalid API Key" } });
    return send(200, { id: "cs_test_" + (++n), url: "https://checkout.stripe.test/pay/cs_test_" + n });
  }
  if (u.pathname === "/emails" && req.method === "POST") return send(200, { id: "em_" + (++n) });
  if (u.pathname === "/turnstile/v0/siteverify" && req.method === "POST") { // jeton « tok-ok » accepté, avec le bon secret
    const ok = /name="secret"\r\n\r\nts_secret_test\r\n/.test(body) && /name="response"\r\n\r\ntok-ok\r\n/.test(body);
    return send(200, { success: ok });
  }
  send(404, { message: "not found" });
}).listen(+(process.argv[2] || 9922), "127.0.0.1", () => console.log("mock services on", process.argv[2] || 9922));
