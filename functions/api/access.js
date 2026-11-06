// シフト表の「見られる人」「追加できる人（管理者）」を管理するAPI
// 必要な設定（Cloudflare Pages の 設定 → 変数とシークレット）:
//   CF_API_TOKEN : Access の アプリとポリシー 編集 権限のAPIトークン（シークレット）
//   OWNER_EMAIL  : 持ち主のメール（管理者を増やす・減らすことができる人）
const ACCT = "5c0946314d5211a39f463309bf43a6c9";
const TEAM = "https://cool-shape-5099.cloudflareaccess.com";
const MEMBER_POLICY = "c23a2025-4cd3-4a74-8101-a411597debc0";
const ADMIN_POLICY_NAME = "shift-admins";
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/access/policies`;

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const low = e => String(e || "").trim().toLowerCase();
const okMail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function b64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

// Cloudflare Access のログイン証明（JWT）を確かめて、ログインしている人のメールを返す
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
  const body = {
    name: pol.name, decision: pol.decision || "allow",
    include: [...new Set(list)].map(e => ({ email: { email: e } })),
    exclude: pol.exclude || [], require: pol.require || []
  };
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
    if (!env.CF_API_TOKEN || !env.OWNER_EMAIL) return J({ me, role: "none", setup: false });
    const owner = low(env.OWNER_EMAIL);
    const apol = await adminPolicy(env, false);
    const admins = apol ? emailsOf(apol) : [];
    const role = me === owner ? "owner" : admins.includes(me) ? "admin" : "none";
    if (role === "none") return J({ me, role, setup: true });

    const mpol = await cf(env, "/" + MEMBER_POLICY);
    let members = emailsOf(mpol);

    if (request.method === "POST") {
      const { action, email } = await request.json();
      const e = low(email);
      if (!okMail(e)) return J({ error: "メールアドレスの形が正しくありません" }, 400);
      if (action === "addMember") {
        if (!members.includes(e)) members = emailsOf(await putEmails(env, mpol, [...members, e]));
      } else if (action === "removeMember") {
        if (e === owner) return J({ error: "持ち主は消せません" }, 400);
        if (e === me) return J({ error: "自分は消せません" }, 400);
        if (admins.includes(e) && role !== "owner") return J({ error: "追加できる人は、持ち主しか消せません" }, 403);
        members = emailsOf(await putEmails(env, mpol, members.filter(x => x !== e)));
        if (admins.includes(e)) await putEmails(env, apol, admins.filter(x => x !== e));
      } else if (action === "addAdmin" || action === "removeAdmin") {
        if (role !== "owner") return J({ error: "追加できる人を変えられるのは持ち主だけです" }, 403);
        const ap = await adminPolicy(env, true);
        const cur = emailsOf(ap);
        if (action === "addAdmin") {
          await putEmails(env, ap, [...cur, e]);
          if (!members.includes(e)) members = emailsOf(await putEmails(env, mpol, [...members, e]));
        } else {
          if (e === owner) return J({ error: "持ち主は外せません" }, 400);
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
