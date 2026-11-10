// 管理者用の動画：管理者とソフト開発者だけが見られる
import { roleOf } from "../api/access.js";
export async function onRequest(ctx) {
  const { role } = await roleOf(ctx.request, ctx.env);
  if (role === "none") return new Response("管理者だけが見られます", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  return ctx.next();
}
