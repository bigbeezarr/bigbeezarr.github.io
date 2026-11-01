// Serveur sans aucune clé facultative : chaque service préparé doit refuser clairement, rien ne fait semblant de marcher.
const API = process.env.API || "http://127.0.0.1:8787";
let ok = 0, bad = 0; const check = (c, l, x) => { c ? ok++ : bad++; console.log(c ? "  ✓" : "  ✗", l, c ? "" : JSON.stringify(x ?? "")); };
const call = async (m, p, { token, body, raw, headers = {} } = {}) => { const h = { ...headers }; if (token) h.Authorization = "Bearer " + token; let b = raw; if (body !== undefined) { h["Content-Type"] = "application/json"; b = JSON.stringify(body); } const r = await fetch(API + p, { method: m, headers: h, body: b }); let d; try { d = await r.json(); } catch { d = null; } return { status: r.status, data: d }; };
const h = (await call("GET", "/api/health")).data;
check(h.content === false && h.notify === false, "état : tout est désactivé", h);
const A = (await call("POST", "/api/admin/login", { body: { password: "motdepasse-de-test" } })).data.token;
const bk = await call("POST", "/api/booking", { body: { first_name: "A", last_name: "B", email: "a@example.com", type: "portrait", description: "Portrait en studio, une heure.", consent: true, elapsed: 9000 } });
check(bk.status === 201, "réservation enregistrée sans service de courriel (visible dans l'administration)", bk.data);
check((await call("GET", "/api/admin/content", { token: A })).data?.error === "content_not_configured", "éditeur du portfolio : refus clair sans jeton GitHub");
console.log(`\n${ok} réussis, ${bad} échoués`); process.exit(bad ? 1 : 0);
