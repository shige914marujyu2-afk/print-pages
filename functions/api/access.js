// マネタイズ班アプリ：ログインした人の確認・名簿（シフト表とは別）・みんなのデータ・要望
// 必要な設定（Cloudflare Pages の 設定 → 変数とシークレット / バインディング）:
//   CF_API_TOKEN     : Access の アプリとポリシー 編集 権限のAPIトークン（シークレット）
//   OWNER_EMAIL      : ソフト開発者のメール
//   MEMBER_POLICY_ID : このアプリ用の「登録利用者」ポリシーのID
//   MZ_KV            : KV（データ・要望の保存場所）
const ACCT = "5c0946314d5211a39f463309bf43a6c9";
const TEAM = "https://cool-shape-5099.cloudflareaccess.com";
const ADMIN_POLICY_NAME = "manetaizu-admins";
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/access/policies`;

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const low = e => String(e || "").trim().toLowerCase();
const okMail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function b64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

async function whoAmI(req) {
  const tok = req.headers.get("cf-access-jwt-assertion") || (req.headers.get("cookie") || "").match(/CF_Authorization=([^;]+)/)?.[1];
  if (!tok) return null;
  const [h, p, sig] = tok.split(".");
  if (!sig) return null;
  const head = JSON.parse(new TextDecoder().decode(b64u(h)));
  const pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (pay.iss !== TEAM) return null;
  if (pay.exp && pay.exp * 1000 < Date.now()) return null;
  const certs = await (await fetch(TEAM + "/cdn-cgi/access/certs", { cf: { cacheTtl: 3600 } })).json();
  const jwk = (certs.keys || []).find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
  return ok ? low(pay.email) : null;
}
async function cf(env, path, opt = {}) {
  const r = await fetch(API + path, { ...opt, headers: { authorization: "Bearer " + env.CF_API_TOKEN, "content-type": "application/json" } });
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw new Error("Cloudflare: " + ((j.errors || []).map(e => e.message).join(" / ") || r.status));
  return j.result;
}
const emailsOf = pol => (pol.include || []).map(r => r.email && low(r.email.email)).filter(Boolean);
async function putEmails(env, pol, list) {
  const body = { name: pol.name, decision: pol.decision || "allow", include: [...new Set(list)].map(e => ({ email: { email: e } })), exclude: pol.exclude || [], require: pol.require || [] };
  if (pol.session_duration) body.session_duration = pol.session_duration;
  return cf(env, "/" + pol.id, { method: "PUT", body: JSON.stringify(body) });
}
async function adminPolicy(env, create) {
  const all = await cf(env, "?per_page=100");
  let pol = all.find(x => x.name === ADMIN_POLICY_NAME);
  if (!pol && create) pol = await cf(env, "", { method: "POST", body: JSON.stringify({ name: ADMIN_POLICY_NAME, decision: "allow", include: [{ email: { email: low(env.OWNER_EMAIL) } }] }) });
  return pol;
}

export async function onRequest({ request, env }) {
  try {
    const me = await whoAmI(request);
    if (!me) return J({ error: "ログインが確認できません" }, 401);
    const url = new URL(request.url), op = url.searchParams.get("op");
    const KV = env.MZ_KV;
    // ログインした人なら誰でも：みんなのデータを読む
    if (request.method === "GET" && op === "team") {
      if (!KV) return J({ data: null });
      return J((await KV.get("team", "json")) || { data: null });
    }
    if (request.method === "POST" && KV) {
      const b0 = await request.clone().json().catch(() => ({}));
      // みんなのデータを保存（ほかの人が先に保存していたら conflict を返す）
      if (b0.action === "saveTeam") {
        const d = String(b0.data || "");
        if (!d.startsWith("{") || d.length > 5000000) return J({ error: "データの形が正しくありません" }, 400);
        const cur = await KV.get("team", "json");
        if (cur && cur.updated && (+b0.base || 0) !== cur.updated) return J({ conflict: true, updated: cur.updated, by: cur.by });
        if (cur) await KV.put("team-prev", JSON.stringify(cur));
        const updated = Date.now();
        await KV.put("team", JSON.stringify({ data: d, updated, by: me }));
        return J({ ok: true, updated });
      }
      if (b0.action === "request") {
        const text = String(b0.text || "").slice(0, 10000);
        const files = (Array.isArray(b0.files) ? b0.files : []).slice(0, 10).map(f => ({ name: String(f.name || "file").slice(0, 100), type: String(f.type || ""), data: String(f.data || "") }));
        const size = files.reduce((a, f) => a + f.data.length, 0);
        if (!text.trim() && !files.length) return J({ error: "要望の文か、ファイルを入れてください" }, 400);
        if (size > 15000000) return J({ error: "ファイルが大きすぎます（合計10MBくらいまで）" }, 400);
        const id = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
        await KV.put("req:" + id, JSON.stringify({ id, from: me, text, files, at: Date.now(), done: false }));
        return J({ ok: true });
      }
    }
    if (!env.CF_API_TOKEN || !env.OWNER_EMAIL || !env.MEMBER_POLICY_ID) return J({ me, role: "none", setup: false });
    const owner = low(env.OWNER_EMAIL);
    const apol = await adminPolicy(env, false);
    const admins = apol ? emailsOf(apol) : [];
    const role = me === owner ? "owner" : admins.includes(me) ? "admin" : "none";
    if (role === "none") return J({ me, role, setup: true });
    if (request.method === "GET" && KV && op === "reqs") {
      const ls = await KV.list({ prefix: "req:" });
      const out = [];
      for (const k of ls.keys) { const v = await KV.get(k.name, "json"); if (!v) continue;
        out.push({ id: v.id, from: v.from, text: v.text, at: v.at, done: !!v.done, files: (v.files || []).map(f => ({ name: f.name, type: f.type, data: url.searchParams.get("full") ? f.data : undefined })) }); }
      out.sort((a, b) => b.at - a.at);
      return J({ items: out });
    }
    const mpol = await cf(env, "/" + env.MEMBER_POLICY_ID);
    let members = emailsOf(mpol);
    if (request.method === "POST") {
      const body = await request.json();
      const { action, email } = body;
      if (action === "reqDel" || action === "reqDone") {
        const key = "req:" + String(body.id || "");
        if (action === "reqDone") { const v = await KV.get(key, "json"); if (v) { v.done = !v.done; await KV.put(key, JSON.stringify(v)); } }
        else await KV.delete(key);
        return J({ ok: true });
      }
      const e = low(email);
      if (!okMail(e)) return J({ error: "メールアドレスの形が正しくありません" }, 400);
      if (action === "addMember") {
        if (!members.includes(e)) members = emailsOf(await putEmails(env, mpol, [...members, e]));
      } else if (action === "removeMember") {
        if (e === owner) return J({ error: "ソフト開発者は消せません" }, 400);
        if (e === me) return J({ error: "自分は消せません" }, 400);
        members = emailsOf(await putEmails(env, mpol, members.filter(x => x !== e)));
        if (admins.includes(e)) await putEmails(env, apol, admins.filter(x => x !== e));
      } else if (action === "addAdmin" || action === "removeAdmin") {
        const ap = await adminPolicy(env, true);
        const cur = emailsOf(ap);
        if (action === "addAdmin") {
          await putEmails(env, ap, [...cur, e]);
          if (!members.includes(e)) members = emailsOf(await putEmails(env, mpol, [...members, e]));
        } else {
          if (e === owner) return J({ error: "ソフト開発者は外せません" }, 400);
          if (e === me) return J({ error: "自分は外せません（ほかの管理者に頼んでください）" }, 400);
          await putEmails(env, ap, cur.filter(x => x !== e));
        }
      } else return J({ error: "不明な操作" }, 400);
    }
    const ap2 = await adminPolicy(env, false);
    return J({ me, role, setup: true, owner, members, admins: ap2 ? emailsOf(ap2) : [] });
  } catch (err) {
    return J({ error: String(err.message || err) }, 500);
  }
}
