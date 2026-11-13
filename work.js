/* アカウントの「作業場」：探す→選ぶ→作る→出す→記録して見直す ＋ ROOMで見つけてもらう ＋ Instagram分析 */
(function(){
  var OPEN = {};            // 開いている段（アカウントごと）
  var DRAFT_PID = {};       // 「作る」で選んでいる商品
  function H(){ return window.MZ_H; }
  function e(s){ return H().esc(s); }
  function enc(s){ return encodeURIComponent(String(s||"").trim()); }
  function copy(t, msg){
    var done = function(){ H().toast(msg || "コピーしました"); };
    if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(t).then(done, function(){ prompt("この文をコピーしてください", t); }); }
    else { prompt("この文をコピーしてください", t); }
  }
  function tagify(s){
    return String(s||"").split(/[\s,、，#＃]+/).filter(Boolean).map(function(x){ return "#" + x; }).join(" ");
  }
  function sec(a, key, title, sub, body){
    var on = !!(OPEN[a.id] && OPEN[a.id][key]);
    return '<details class="wk"' + (on ? " open" : "") + ' data-wk="' + key + '"><summary><b>' + title + '</b><span class="hint">' + sub + '</span></summary><div class="wkb">' + body + '</div></details>';
  }
  function draftOf(p){ if(!p.draft) p.draft = { who:"", trouble:"", after:"", tags:"" }; return p.draft; }

  /* ---- ROOMの中で見つけてもらう（2026-11-13 追加） ---- */
  var RM_USED = ["使っていない（気になって選んだ）","買って使っている","買ったが、まだあまり使っていない"];
  var RM_CHK = [
    ["fact","商品ページにない事実・数字が入っていない（1行ずつ見比べた）"],
    ["used","使っていないのに、使ったふりをしていない"],
    ["tag","ハッシュタグは半角の # で、商品に合う言葉だけ"],
    ["push","「タップしてね」など、押すのを頼む言葉がない"],
    ["len","500字に入っている"],
    ["seen","自分がROOMで見た言葉が入っている"]
  ];
  var RM_RULES = "守ること：①商品と関係ない言葉を並べない ②同じ文を使い回さない（商品ごとに変える） ③貼るのは自分の手で1件ずつ（自動で投稿しない） ④レビューの文・商品の画像を写さない ⑤使っていない物を「使っています」と書かない。破ると投稿の削除や報酬の取り消しになることがあります。";
  function rmOf(p){
    if(!p.rm || typeof p.rm !== "object") p.rm = {};
    var r = p.rm; ["facts","used","seen","coupon","text"].forEach(function(k){ if(typeof r[k] !== "string") r[k] = ""; });
    if(!r.used) r.used = RM_USED[0];
    if(!r.chk || typeof r.chk !== "object") r.chk = {};
    return r;
  }
  function words(s){ return String(s||"").split(/[\s,、，#＃]+/).filter(Boolean); }
  function roomAsk(a, p){
    var r = rmOf(p), d = draftOf(p);
    return "あなたは楽天ROOMの紹介文づくりを手伝う係です。下の【材料】だけを使ってください。\n\n" +
      "【決まり】\n" +
      "1. 材料にない事実（性能・数字・感想）は書き足さない。分からないことは書かない。\n" +
      "2. 「使ったことがあるか」の答えに合わせる。使っていないなら、使った感想や「買ってよかった」「オリジナル写真」は入れない。\n" +
      "3. 商品のリンク・画像・レビューの文は受け取らない。楽天のページも開かない。材料は私が自分で打ったものだけ。\n" +
      "4. 「楽天市場で見るをタップ」のように、押すことを頼む言葉は入れない。\n" +
      "5. ハッシュタグは半角の # で、商品に合う言葉だけを5〜8個。人気の言葉でも合わなければ入れない。\n" +
      "6. 紹介文はハッシュタグ込みで500字以内（目安は300〜450字）。\n\n" +
      "【出してほしいもの】この順で、1回でまとめて。\n" +
      "① 言葉の表：楽天ROOMの中で探されていそうな言葉を10個前後。それぞれ「商品に合う○／合わない×」と理由を一言。「自分がROOMで見た言葉」は必ず表に入れる。\n" +
      "② 紹介文：1行目は一覧で手が止まる一言（クーポン・値引きがあればそれ。なければ問いかけか【 】で囲んだ一言）→ 困っている場面 → 選んだ理由 → ✔で事実を3つ → 「こんな人に」→ ハッシュタグ。\n" +
      "③ コレクション名の案を3つ（50字以内。何のまとまりか一目で分かる名前）。\n" +
      "④ プロフィールに入れる一文（何を紹介しているROOMかが分かる言葉で、80字以内）。\n" +
      "⑤ 確かめの表：材料にないことが入っていないか／使ったふりをしていないか／ハッシュタグは半角で商品に合うか／押すのを頼む言葉がないか／500字以内か／自分がROOMで見た言葉が入っているか、を○×で。\n" +
      "材料が足りなくて書けないところは、作る前に質問してください。\n\n" +
      "【材料】\n" +
      "・アカウント：" + a.name + "（テーマ：" + (a.theme || "未設定") + "／誰に・何を：" + (a.target || "未設定") + "）\n" +
      "・商品名：" + p.name + (p.price ? "（" + p.price + "円）" : "") + "\n" +
      "・商品の事実（自分で商品ページを見て打ったもの）：\n" + (r.facts || "（未入力）") + "\n" +
      "・届けたい人：" + (d.who || "（未入力。候補を3つ出してください）") + "\n" +
      "・使ったことがあるか：" + r.used + "\n" +
      "・自分がROOMで見た言葉：" + (r.seen || "（未入力）") + "\n" +
      (a.roomWords ? "・ROOMで探されている言葉の控え：" + a.roomWords.replace(/\r?\n/g, "、") + "\n" : "") +
      "・クーポン・値引き：" + (r.coupon || "なし");
  }
  function roomWarn(r){
    var t = r.text || "", w = [];
    if(!t.trim()) return w;
    if(t.length > 500) w.push("500字を超えています（" + t.length + "字）。ROOMのコメント欄に入りきりません。");
    if(/＃/.test(t)) w.push("全角の「＃」があります。半角の # に直さないと、ハッシュタグとして動きません。");
    if(/(を|で)?(タップ|クリック)(して|を|！|!|$)|押して(ね|みて|ください)|ポチっ|ポチッ/m.test(t)) w.push("押すのを頼む言葉が入っているようです（タップ・クリック・押してね など）。消してください。");
    var tags = t.match(/#[^\s#＃]+/g) || [];
    if(!tags.length) w.push("半角 # のハッシュタグがありません。");
    else if(tags.length > 8) w.push("ハッシュタグが" + tags.length + "個あります。商品に合うものを5〜8個に絞るのがおすすめです。");
    if(r.used === RM_USED[0] && /買ってよかった|オリジナル写真|愛用|使ってみたら|リピ買い/.test(t)) w.push("「使っていない」商品なのに、使った・買ったと読める言葉があります（買ってよかった・愛用 など）。");
    var miss = words(r.seen).filter(function(x){ return t.indexOf(x) < 0; });
    if(miss.length) w.push("自分がROOMで見た言葉が入っていません：" + miss.join("、"));
    return w;
  }
  function postedCount(a){ return a.products.filter(function(p){ return p.status && p.status !== "未投稿"; }).length; }
  function texts(a, p){
    var d = draftOf(p), tags = tagify(d.tags);
    var who = d.who || "（誰が）", tr = d.trouble || "（何に困って）", af = d.after || "（これでどうなる）";
    var room = who + "の「" + tr + "」に。\n" + p.name + "で、" + af + "。\n" + tags;
    var ig = "【" + who + "へ】\n" + tr + "…そんな悩みありませんか？\n\n" + p.name + "を使ってみたら、" + af + "。\n\n" +
      "▶ 気になった方はプロフィールの楽天ROOMから見られます\n▶ 保存しておくと、あとで見返せます\n\n" + tags;
    var reel = "【リールの台本ラフ（15〜30秒）】\n" +
      "1. つかみ（0〜3秒）：「" + tr + "、ありませんか？」と困っている場面\n" +
      "2. 共感（3〜7秒）：" + who + "あるあるを一言で\n" +
      "3. 解決（7〜15秒）：" + p.name + "を出して、使っているところ\n" +
      "4. 変化（15〜22秒）：" + af + "（使う前と後を並べる）\n" +
      "5. 行動（22〜30秒）：「プロフィールの楽天ROOMから見られます・保存してね」\n" +
      "画面の文字：大きく短く（1画面15文字まで）";
    var illust = "【イラストのラフ案】\n" +
      "・1枚目：困っている人（" + who + "）と吹き出し「" + tr + "」\n" +
      "・2枚目：" + p.name + "の絵と、使いどころの矢印\n" +
      "・3枚目：" + af + "の笑顔の場面＋「プロフィールのROOMへ」";
    var ask = "次の商品を、楽天ROOMとInstagramで紹介します。下書きを作ってください。\n" +
      "・アカウント：" + a.name + "（テーマ：" + (a.theme || "未設定") + "／誰に・何を：" + (a.target || "未設定") + "）\n" +
      "・商品：" + p.name + (p.price ? "（" + p.price + "円）" : "") + (p.link ? "\n・リンク：" + p.link : "") + "\n" +
      "・誰が：" + (d.who || "未入力") + "／何に困って：" + (d.trouble || "未入力") + "／これでどうなる：" + (d.after || "未入力") + "\n" +
      "・ハッシュタグの候補：" + (tags || "未入力") + "\n\n" +
      "ほしいもの：①楽天ROOM用の短い紹介文 ②Instagram用の投稿文（ハッシュタグは探す人が使う言葉で） ③リール（15〜30秒）の台本と画面の流れ ④イラスト（3枚）のラフ案。投稿は自分でします。";
    return { room:room, ig:ig, reel:reel, illust:illust, ask:ask };
  }
  function calLink(p, date){
    var d = String(date||"").replace(/-/g,"");
    var t = "【ゼロコレ】0時に投稿：" + p.name;
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + enc(t) +
      "&dates=" + d + "T000000/" + d + "T001500&ctz=Asia/Tokyo&details=" + enc("マネタイズ班アプリのリマインド。投稿→ストーリーズにリンク→ハイライトに保存→プロフィールにROOMリンク");
  }
  function nextDay(){ var x = new Date(Date.now() + 864e5); return x.getFullYear() + "-" + ("0"+(x.getMonth()+1)).slice(-2) + "-" + ("0"+x.getDate()).slice(-2); }
  function parseInsight(raw){
    var rows = [];
    String(raw||"").split(/\r?\n/).forEach(function(line){
      var c = line.split(/[,\t，]/).map(function(x){ return x.trim(); });
      if(c.length < 3 || !/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(c[0])) return;
      var n = function(i){ return Number(String(c[i]||"").replace(/[^\d.]/g,"")) || 0; };
      rows.push({ date:c[0].replace(/\//g,"-"), post:c[1]||"", play:n(2), reach:n(3), like:n(4), save:n(5) });
    });
    return rows;
  }
  var INSIGHT_ASK = "Instagramのインサイトを、次の形で1行1件、新しい日付から並べて書き出してください（カンマ区切り・見出し行なし）。\n" +
    "日付,投稿の名前,再生回数,リーチ,いいね,保存\n例：2026-11-11,〇〇の紹介リール,1200,900,45,12\n" +
    "そのあとに、見ている人の年齢・性別・時間帯のまとめを数行で書いてください。";

  window.MZ_WORK = function(a, root){
    if(!root) return;
    OPEN[a.id] = OPEN[a.id] || {}; if(!Array.isArray(a.cands)) a.cands = [];
    var kw = a._kw || a.theme || "";
    var good = a.products.filter(function(p){ return p.status === "売れた" || p.status === "再紹介する"; });
    var perP = {};
    a.records.forEach(function(r){ if(!r.pid) return; perP[r.pid] = perP[r.pid] || { c:0, s:0, n:0 }; perP[r.pid].c += Number(r.clicks)||0; perP[r.pid].s += Number(r.sales)||0; perP[r.pid].n++; });

    // ① 探す
    var candHtml = a.cands.length ? a.cands.map(function(c){
      return '<div class="item-row"><div class="head"><div class="main"><div class="t">' + e(c.name) + (c.price ? ' <span class="num small">' + H().yen(c.price) + '</span>' : '') + '</div>' +
        '<div class="meta">' + (c.url ? '<a href="' + e(c.url) + '" target="_blank" rel="noopener">商品ページ</a>' : '商品ページ未入力') +
        ' ／ ' + (c.room ? '<a href="' + e(c.room) + '" target="_blank" rel="noopener">ROOMに貼るリンク</a>' : 'ROOMリンク未入力') + '</div>' +
        (c.memo ? '<div class="meta">' + e(c.memo) + '</div>' : '') + '</div>' +
        '<button type="button" class="del-btn" data-wk-delc="' + c.id + '">削除</button></div>' +
        '<button type="button" class="btn small mt" data-wk-pick="' + c.id + '">② 紹介する商品に入れる</button></div>';
    }).join("") : '<p class="small">まだ候補はありません。上の窓口で探して、良さそうな商品を下から保存してください。</p>';
    var s1 = '<div class="field"><label for="wkTarget">誰に・何を届けるアカウント？</label>' +
      '<input type="text" id="wkTarget" value="' + e(a.target) + '" placeholder="例）40〜50代の夫婦に、ゆる健康ごはんの道具を" /></div>' +
      '<div class="field"><label for="wkKw">探す言葉</label><input type="text" id="wkKw" value="' + e(kw) + '" placeholder="例）低糖質 おやつ" /></div>' +
      '<div class="row-flex wkbtns">' +
        '<a class="btn small" target="_blank" rel="noopener" href="https://search.rakuten.co.jp/search/mall/' + enc(kw) + '/?s=4">楽天市場（売れている順）</a>' +
        '<a class="btn small" target="_blank" rel="noopener" href="https://room.rakuten.co.jp/search/item?keyword=' + enc(kw) + '">楽天ROOMで探す</a>' +
        '<a class="btn small sub" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + enc(kw + " 紹介") + '">関連の動画</a>' +
        '<a class="btn small sub" target="_blank" rel="noopener" href="https://www.instagram.com/explore/search/keyword/?q=' + enc(kw) + '">Instagramで見る</a>' +
      '</div><p class="note">言葉を変えたら、ボタンの行き先も変わります。ROOMに貼るリンクは、楽天ROOMの商品ページで「コレ！」を押す画面のアドレスを貼ってください。</p>' +
      '<hr class="divider" /><p style="font-weight:700;margin:0 0 8px">候補を保存</p>' +
      '<div class="field"><label>商品名</label><input type="text" id="wkCn" placeholder="商品名" /></div>' +
      '<div class="row-flex"><div class="field grow"><label>価格（円）</label><input type="number" id="wkCp" min="0" placeholder="3980" /></div></div>' +
      '<div class="field"><label>商品ページのリンク</label><input type="url" id="wkCu" placeholder="https://item.rakuten.co.jp/…" /></div>' +
      '<div class="field"><label>ROOMに貼るリンク</label><input type="url" id="wkCr" placeholder="https://room.rakuten.co.jp/…" /></div>' +
      '<div class="field"><label>メモ</label><input type="text" id="wkCm" placeholder="選んだ理由、切り口など" /></div>' +
      '<button type="button" class="btn" id="wkCadd">候補に保存</button>' +
      '<hr class="divider" /><p style="font-weight:700;margin:0 0 8px">候補（' + a.cands.length + '）</p>' + candHtml;

    // ② 選ぶ
    var s2 = '<p class="desc">紹介する商品は、下の「商品リスト」にあります（' + a.products.length + '件）。</p>' +
      '<p style="font-weight:700;margin:8px 0 6px">反応が良かった商品（切り口を変えて再紹介の候補）</p>' +
      (good.length ? good.map(function(p){ var t = perP[p.id];
        return '<div class="item-row"><div class="t">' + e(p.name) + '</div><div class="meta">状態：' + e(p.status) + (t ? ' ／ クリック ' + t.c + ' ／ 売上 ' + H().yen(t.s) : '') + '</div>' +
          '<button type="button" class="btn small mt" data-wk-redo="' + p.id + '">③ 新しい切り口で作る</button></div>';
      }).join("") : '<p class="small">商品の状態を「売れた」「再紹介する」にすると、ここに出ます。</p>');

    // ③ 作る
    var pid = DRAFT_PID[a.id]; if(!a.products.some(function(p){ return p.id === pid; })) pid = a.products.length ? a.products[0].id : "";
    var P = a.products.filter(function(p){ return p.id === pid; })[0];
    var s3;
    if(!P){ s3 = '<p class="small">先に「紹介する商品」を入れてください（① の候補から入れるか、下の商品リストで追加）。</p>'; }
    else {
      var d = draftOf(P), T = texts(a, P);
      s3 = '<div class="field"><label>どの商品？</label><select id="wkDp">' + a.products.map(function(p){ return '<option value="' + p.id + '"' + (p.id === pid ? " selected" : "") + '>' + e(p.name) + '</option>'; }).join("") + '</select></div>' +
        '<p class="note">型：「誰が・何に困って・これでどうなるか」＋探す人が使う言葉のハッシュタグ</p>' +
        '<div class="field"><label>誰が</label><input type="text" id="wkDw" value="' + e(d.who) + '" placeholder="例）忙しい共働き夫婦" /></div>' +
        '<div class="field"><label>何に困って</label><input type="text" id="wkDt" value="' + e(d.trouble) + '" placeholder="例）夜ごはんの準備に時間がない" /></div>' +
        '<div class="field"><label>これでどうなる</label><input type="text" id="wkDa" value="' + e(d.after) + '" placeholder="例）10分で1品できる" /></div>' +
        '<div class="field"><label>ハッシュタグの言葉（スペース区切り）</label><input type="text" id="wkDh" value="' + e(d.tags) + '" placeholder="例）時短ごはん 作り置き 楽天ROOM" /></div>' +
        '<button type="button" class="btn" id="wkDsave">下書きを作る（保存）</button>' +
        [["楽天ROOM用（短め）","room"],["Instagram用（長め）","ig"],["リールの台本ラフ","reel"],["イラストのラフ案","illust"]].map(function(x){
          return '<div class="wkout"><div class="wkoh"><b>' + x[0] + '</b><button type="button" class="btn sub small" data-wk-copy="' + x[1] + '">コピー</button></div><pre>' + e(T[x[1]]) + '</pre></div>';
        }).join("") +
        '<div class="wkout"><div class="wkoh"><b>🤖 AI（Muse・Claude）に頼む文</b><button type="button" class="btn small" data-wk-copy="ask">コピー</button></div><p class="note">コピーしてMuseやClaudeに貼ると、もっと良い下書き・本番のリール作りを頼めます。投稿はご自身で行います。</p></div>';
      var R = rmOf(P), W = roomWarn(R);
      s3 += '<hr class="divider" /><p style="font-weight:700;margin:0 0 4px">🏠 ROOMの中で見つけてもらう紹介文（Claudeと作る）</p>' +
        '<p class="note">流れ：商品ページを自分の目で見て事実を打つ → 頼む文をコピーしてClaudeに貼る → 返ってきた紹介文をここに貼る → 商品ページと1行ずつ見比べて直す → ROOMに自分で貼る。</p>' +
        '<div class="field"><label>商品の事実（自分で打つ。リンク・画像・レビューは入れない）</label><textarea class="area" id="wkRf" rows="5" placeholder="例）幅42×奥行29×高さ88cm／棚1段の耐荷重○kg／ドライバーで組み立て／横置きできる／色は白・茶／送料無料（一部地域を除く）">' + e(R.facts) + '</textarea></div>' +
        '<div class="field"><label>使ったことがある？（正直に）</label><select id="wkRu">' + RM_USED.map(function(u){ return '<option' + (R.used === u ? " selected" : "") + '>' + u + '</option>'; }).join("") + '</select></div>' +
        '<div class="field"><label>自分がROOMの検索で見た言葉（スペース区切り）</label><input type="text" id="wkRs" value="' + e(R.seen) + '" placeholder="例）収納 カラーボックス" /></div>' +
        '<div class="field"><label>クーポン・値引き（あれば）</label><input type="text" id="wkRc" value="' + e(R.coupon) + '" placeholder="例）○日まで10%OFFクーポン" /></div>' +
        '<button type="button" class="btn" id="wkRask">📋 Claudeに頼む文をコピー</button>' +
        '<p class="note">「届けたい人」は上の「誰が」を使います。空なら、Claudeが候補を3つ出します。</p>' +
        '<div class="field mt"><label>できた紹介文を貼る <span id="wkRn" class="num"></span></label><textarea class="area" id="wkRt" rows="8" placeholder="Claudeが作った紹介文（ハッシュタグ込み）を貼って、商品ページと見比べて直します">' + e(R.text) + '</textarea></div>' +
        '<div id="wkRw"></div>' +
        '<div class="row-flex wkbtns"><button type="button" class="btn sub small" id="wkRfix">＃を半角に直す</button><button type="button" class="btn small" id="wkRcopy">紹介文をコピー（ROOMに貼る用）</button></div>' +
        '<p style="font-weight:700;margin:12px 0 2px">出す前の確かめ <span class="hint" id="wkRcn"></span></p>' +
        RM_CHK.map(function(c){ return '<label class="wkchk"><input type="checkbox" data-wk-rchk="' + c[0] + '"' + (R.chk[c[0]] ? " checked" : "") + '> ' + c[1] + '</label>'; }).join("") +
        '<div class="warn-box" style="margin-top:10px">' + RM_RULES + '</div>' +
        '<p class="note">ROOMに貼ったら、下の商品リストで状態を「投稿済み」にしてください（投稿30件の数に入ります）。</p>';
    }

    // ④ 出す
    var s4 = (a.products.length ? a.products.map(function(p){
      var dt = p.zeroDate || nextDay();
      return '<div class="item-row"><div class="t">' + e(p.name) + '</div>' +
        '<label class="wkchk"><input type="checkbox" data-wk-zero="' + p.id + '"' + (p.zero ? " checked" : "") + '> 勝負投稿（ゼロコレ）にする</label>' +
        (p.zero ? '<div class="row-flex mt"><div class="field grow mb0"><label>投稿する日（その日の0時）</label><input type="date" data-wk-zd="' + p.id + '" value="' + e(dt) + '"></div></div>' +
          '<a class="btn small mt" target="_blank" rel="noopener" href="' + calLink(p, dt) + '">📅 0時のリマインドをカレンダーに入れる</a>' : '') + '</div>';
    }).join("") : '<p class="small">紹介する商品を入れると、ここで勝負投稿の印とリマインドが付けられます。</p>') +
      '<p class="note">投稿のあとは、下の「導線チェック」（投稿→ストーリーズ→ハイライト→プロフィール）を済みにしてください。</p>';

    // ⑤ 記録して見直す
    var rows = a.products.map(function(p){ var t = perP[p.id] || { c:0, s:0, n:0 }; return { p:p, t:t }; }).sort(function(x,y){ return y.t.s - x.t.s || y.t.c - x.t.c; });
    var s5 = '<p class="desc">下の「記録」で商品を選んで入れると、商品ごとに合計されます。</p>' +
      (rows.length ? '<table class="wktbl"><tr><th>商品</th><th>クリック</th><th>売上</th></tr>' + rows.map(function(r){ return '<tr><td>' + e(r.p.name) + '</td><td class="num">' + r.t.c + '</td><td class="num">' + H().yen(r.t.s) + '</td></tr>'; }).join("") + '</table>' : '') +
      '<hr class="divider" /><p style="font-weight:700;margin:0 0 8px">楽天ROOMのランク</p>' +
      '<div class="row-flex"><div class="field grow"><label>今のランク</label><input type="text" id="wkRank" value="' + e(a.rank) + '" placeholder="例）C"></div>' +
      '<div class="field grow"><label>確認した日</label><input type="date" id="wkRankD" value="' + e(a.rankDate) + '"></div></div>' +
      '<div class="field"><label>次のランクの条件メモ（毎月変わります）</label><textarea class="area" id="wkRankN" placeholder="例）オリジナル写真の投稿 ○件、売上 ○件 など">' + e(a.rankNext) + '</textarea></div>' +
      '<button type="button" class="btn sub" id="wkRankSave">ランクを保存</button>';

    // 🔎 ROOMで見つけてもらう場所
    ["roomWords","roomProfile","roomCols"].forEach(function(k){ if(typeof a[k] !== "string") a[k] = ""; });
    var pc = postedCount(a), pcw = Math.min(100, Math.round(pc / 30 * 100));
    var longCols = a.roomCols.split(/\r?\n/).filter(function(l){ return l.trim().length > 50; });
    var s7 = '<p class="desc">SNSで発信しなくても、ROOMの中で見つけてもらえる場所は3つ：ハッシュタグ・プロフィール・コレクション。探されている言葉の中から、商品に合うものだけを入れます。</p>' +
      '<p style="font-weight:700;margin:0 0 4px">最初の目標：投稿30件 <span class="hint">' + pc + ' / 30</span></p>' +
      '<div class="wkbar" style="grid-template-columns:1fr auto"><i style="width:' + Math.max(pcw, 1) + '%"></i><b class="num">' + (pc >= 30 ? "達成！" : "あと" + (30 - pc) + "件") + '</b></div>' +
      '<p class="note">商品リストで状態が「投稿済み・売れた・再紹介する」の商品を数えています。1件ずつ、文は商品ごとに変えて足していきます。</p>' +
      '<hr class="divider" /><div class="field"><label>ROOMで探されている言葉の控え</label><textarea class="area" id="wkWords" rows="4" placeholder="ROOMの「人気検索ワード」「注目の検索ワード」や、検索して見つけた言葉を控えます。例）収納 買ってよかった オリジナル写真 時短">' + e(a.roomWords) + '</textarea>' +
      '<p class="note">ここに書いた言葉は、③の「Claudeに頼む文」に自動で入ります。人気でも商品に合わない言葉は使いません（Claudeが○×を付けます）。</p></div>' +
      '<div class="field"><label>ROOMのプロフィール文 <span id="wkPfn" class="num"></span></label><textarea class="area" id="wkPf" rows="4" placeholder="何を紹介しているROOMかが分かる言葉を入れます（ROOMのユーザー検索はプロフィールの中身が対象）">' + e(a.roomProfile) + '</textarea>' +
      '<button type="button" class="btn sub small mt" id="wkPfCopy">プロフィール文をコピー</button></div>' +
      '<div class="field"><label>コレクションの名前（1行に1つ・50字まで）</label><textarea class="area" id="wkCols" rows="3" placeholder="例）ワンルームの収納棚">' + e(a.roomCols) + '</textarea>' +
      (longCols.length ? '<p class="note" style="color:var(--danger,#b5323a)">50字を超えている名前があります：' + e(longCols.join(" ／ ")) + '</p>' : '') +
      '<p class="note">何のまとまりか一目で分かる名前に。投稿を足すたびに、コレクションのフィードにまた出るチャンスがあります。</p></div>' +
      '<button type="button" class="btn" id="wkRoomSave">この段を保存</button>' +
      '<div class="warn-box" style="margin-top:10px">' + RM_RULES + '</div>' +
      '<p class="note">字数（500字・232字・50字）や決まりは、動画（2026-11-13に確認）で紹介されていた楽天ROOMの画面・案内の内容です。変わることがあるので、迷ったら楽天ROOMの公式の案内を見てください。</p>';

    // ⑥ 分析
    var ins = parseInsight(a.insight);
    var tot = ins.reduce(function(s,r){ s.play += r.play; s.reach += r.reach; s.like += r.like; s.save += r.save; return s; }, { play:0, reach:0, like:0, save:0 });
    var top = ins.slice().sort(function(x,y){ return y.play - x.play; }).slice(0,3);
    var mx = Math.max.apply(null, ins.map(function(r){ return r.play; }).concat([1]));
    var byDay = {}; ins.forEach(function(r){ byDay[r.date] = (byDay[r.date]||0) + r.play; });
    var days = Object.keys(byDay).sort().slice(-14);
    var dmx = Math.max.apply(null, days.map(function(k){ return byDay[k]; }).concat([1]));
    var s6 = '<p class="desc">Museに頼んでインサイト（再生回数など）を書き出してもらい、ここに貼ります。インサイトはプロアカウント（ビジネス／クリエイター）が対象です。</p>' +
      '<button type="button" class="btn sub small" id="wkInsAsk">📋 Museへの頼み方をコピー</button>' +
      '<div class="field mt"><label>Museが書き出した分析（そのまま貼る）</label><textarea class="area" id="wkIns" rows="6" placeholder="2026-11-11,〇〇の紹介リール,1200,900,45,12">' + e(a.insight) + '</textarea></div>' +
      '<button type="button" class="btn" id="wkInsSave">分析を取り込む</button>' +
      (ins.length ? '<div class="wkgrid"><div><b class="num">' + tot.play.toLocaleString("ja-JP") + '</b><span>再生</span></div><div><b class="num">' + tot.reach.toLocaleString("ja-JP") + '</b><span>リーチ</span></div><div><b class="num">' + tot.like.toLocaleString("ja-JP") + '</b><span>いいね</span></div><div><b class="num">' + tot.save.toLocaleString("ja-JP") + '</b><span>保存</span></div></div>' +
        '<p style="font-weight:700;margin:10px 0 4px">日ごとの再生回数</p><div class="wkbars">' + days.map(function(k){ return '<div class="wkbar"><span>' + k.slice(5) + '</span><i style="width:' + Math.round(byDay[k]/dmx*100) + '%"></i><b class="num">' + byDay[k].toLocaleString("ja-JP") + '</b></div>'; }).join("") + '</div>' +
        '<p style="font-weight:700;margin:10px 0 4px">伸びている投稿</p>' + top.map(function(r,i){ return '<div class="wkbar"><span>' + (i+1) + '位</span><i style="width:' + Math.round(r.play/mx*100) + '%"></i><b>' + e(r.post) + '（' + r.play.toLocaleString("ja-JP") + '）</b></div>'; }).join("") : '<p class="small mt">まだ分析は入っていません。</p>') +
      '<hr class="divider" /><button type="button" class="btn" id="wkConsult">💬 相談用にまとめてコピー（Museに貼る）</button>' +
      '<p class="note">アカウントの基本・分析・商品と反応を1つの文にまとめます。Museに貼って「次に何を紹介する？」「リールをどう作る？」などを相談してください。</p>';

    root.innerHTML = '<div class="card wkcard"><h2>作業場 <span class="hint">探す→選ぶ→作る→出す→記録して見直す</span></h2>' +
      sec(a, "s1", "① 探す", "テーマに合う商品を探して候補に", s1) +
      sec(a, "s2", "② 選ぶ", "紹介する商品・再紹介の候補", s2) +
      sec(a, "s3", "③ 作る", "紹介文・リール・イラストの下書き", s3) +
      sec(a, "s4", "④ 出す", "勝負投稿（ゼロコレ）と0時のリマインド", s4) +
      sec(a, "s5", "⑤ 記録して見直す", "商品ごとの反応・ROOMのランク", s5) +
      sec(a, "s7", "🔎 ROOMで見つけてもらう", "探されている言葉・プロフィール・コレクション・投稿30件", s7) +
      sec(a, "s6", "📊 分析と相談", "Instagramの数字・Museへの相談", s6) + '</div>';

    var $ = function(id){ return document.getElementById(id); };
    root.querySelectorAll("details[data-wk]").forEach(function(dt){ dt.addEventListener("toggle", function(){ OPEN[a.id][dt.getAttribute("data-wk")] = dt.open; }); });
    $("wkTarget").addEventListener("change", function(){ a.target = this.value.trim(); H().saveOnly(); H().toast("保存しました"); });
    $("wkKw").addEventListener("change", function(){ a._kw = this.value.trim(); OPEN[a.id].s1 = true; H().save(); });
    $("wkCadd").addEventListener("click", function(){
      var n = $("wkCn").value.trim(); if(!n) return H().toast("商品名を入れてください");
      a.cands.unshift({ id:H().uid(), name:n, price:Number($("wkCp").value)||0, url:$("wkCu").value.trim(), room:$("wkCr").value.trim(), memo:$("wkCm").value.trim(), at:H().todayStr() });
      OPEN[a.id].s1 = true; H().save(); H().toast("候補に保存しました");
    });
    root.querySelectorAll("[data-wk-delc]").forEach(function(b){ b.addEventListener("click", function(){
      var id = b.getAttribute("data-wk-delc"); H().confirm("この候補を削除しますか？", function(){ a.cands = a.cands.filter(function(c){ return c.id !== id; }); OPEN[a.id].s1 = true; H().save(); });
    }); });
    root.querySelectorAll("[data-wk-pick]").forEach(function(b){ b.addEventListener("click", function(){
      var id = b.getAttribute("data-wk-pick"), c = a.cands.filter(function(x){ return x.id === id; })[0]; if(!c) return;
      a.products.push({ id:H().uid(), name:c.name, price:c.price||0, link:c.room || c.url || "", status:"未投稿", memo:c.memo || "" });
      a.cands = a.cands.filter(function(x){ return x.id !== id; });
      OPEN[a.id].s1 = true; OPEN[a.id].s3 = true; DRAFT_PID[a.id] = a.products[a.products.length-1].id;
      H().save(); H().toast("紹介する商品に入れました（③ で下書きを作れます）");
    }); });
    root.querySelectorAll("[data-wk-redo]").forEach(function(b){ b.addEventListener("click", function(){
      DRAFT_PID[a.id] = b.getAttribute("data-wk-redo"); OPEN[a.id].s3 = true; H().save();
      var d3 = root.querySelector('[data-wk="s3"]'); if(d3) d3.scrollIntoView({ block:"start" });
    }); });
    if($("wkDp")){
      $("wkDp").addEventListener("change", function(){ DRAFT_PID[a.id] = this.value; OPEN[a.id].s3 = true; H().save(); });
      $("wkDsave").addEventListener("click", function(){
        var d = draftOf(P); d.who = $("wkDw").value.trim(); d.trouble = $("wkDt").value.trim(); d.after = $("wkDa").value.trim(); d.tags = $("wkDh").value.trim();
        OPEN[a.id].s3 = true; H().save(); H().toast("下書きを作りました");
      });
      root.querySelectorAll("[data-wk-copy]").forEach(function(b){ b.addEventListener("click", function(){ copy(texts(a, P)[b.getAttribute("data-wk-copy")]); }); });
    }
    if($("wkRt")){
      var R2 = rmOf(P);
      var rmDraw = function(){
        var n = R2.text.length; $("wkRn").textContent = n ? "（" + n + " / 500字）" : "";
        $("wkRn").style.color = n > 500 ? "var(--danger,#b5323a)" : "";
        var w = roomWarn(R2);
        $("wkRw").innerHTML = w.length ? '<div class="warn-box">' + w.map(function(x){ return "⚠️ " + e(x); }).join("<br>") + '</div>' : (R2.text.trim() ? '<p class="note">✅ 自動で分かる範囲では問題は見つかりませんでした。最後は商品ページと1行ずつ見比べてください。</p>' : '');
        var c = RM_CHK.filter(function(x){ return R2.chk[x[0]]; }).length; $("wkRcn").textContent = c + " / " + RM_CHK.length + " 済み";
      };
      var rmKeep = function(){ R2.facts = $("wkRf").value.trim(); R2.used = $("wkRu").value; R2.seen = $("wkRs").value.trim(); R2.coupon = $("wkRc").value.trim(); R2.text = $("wkRt").value; };
      ["wkRf","wkRu","wkRs","wkRc","wkRt"].forEach(function(id){ $(id).addEventListener("change", function(){ rmKeep(); H().saveOnly(); rmDraw(); }); });
      $("wkRt").addEventListener("input", function(){ R2.text = this.value; rmDraw(); });
      $("wkRask").addEventListener("click", function(){
        rmKeep(); H().saveOnly();
        if(!R2.facts) return H().toast("先に「商品の事実」を打ってください");
        copy(roomAsk(a, P), "頼む文をコピーしました。Claudeの新しいチャットに貼ってください");
      });
      $("wkRfix").addEventListener("click", function(){ $("wkRt").value = $("wkRt").value.replace(/＃/g, "#"); rmKeep(); H().saveOnly(); rmDraw(); H().toast("＃を半角に直しました"); });
      $("wkRcopy").addEventListener("click", function(){
        rmKeep(); H().saveOnly();
        if(!R2.text.trim()) return H().toast("紹介文がまだありません");
        var w = roomWarn(R2); copy(R2.text, w.length ? "コピーしました（⚠️注意が" + w.length + "件あります）" : "紹介文をコピーしました");
      });
      root.querySelectorAll("[data-wk-rchk]").forEach(function(c){ c.addEventListener("change", function(){ R2.chk[c.getAttribute("data-wk-rchk")] = c.checked; H().saveOnly(); rmDraw(); }); });
      rmDraw();
    }
    var pfDraw = function(){ var n = $("wkPf").value.length; $("wkPfn").textContent = n ? "（" + n + " / 232字）" : ""; $("wkPfn").style.color = n > 232 ? "var(--danger,#b5323a)" : ""; };
    $("wkPf").addEventListener("input", pfDraw); pfDraw();
    var roomKeep = function(){ a.roomWords = $("wkWords").value.trim(); a.roomProfile = $("wkPf").value.trim(); a.roomCols = $("wkCols").value.trim(); };
    ["wkWords","wkPf","wkCols"].forEach(function(id){ $(id).addEventListener("change", function(){ roomKeep(); H().saveOnly(); }); });
    $("wkRoomSave").addEventListener("click", function(){ roomKeep(); OPEN[a.id].s7 = true; H().save(); H().toast("保存しました"); });
    $("wkPfCopy").addEventListener("click", function(){ roomKeep(); H().saveOnly(); if(!a.roomProfile) return H().toast("プロフィール文がまだありません"); copy(a.roomProfile, "プロフィール文をコピーしました"); });
    root.querySelectorAll("[data-wk-zero]").forEach(function(c){ c.addEventListener("change", function(){
      var p = a.products.filter(function(x){ return x.id === c.getAttribute("data-wk-zero"); })[0]; if(!p) return;
      p.zero = c.checked; if(p.zero && !p.zeroDate) p.zeroDate = nextDay(); OPEN[a.id].s4 = true; H().save();
    }); });
    root.querySelectorAll("[data-wk-zd]").forEach(function(c){ c.addEventListener("change", function(){
      var p = a.products.filter(function(x){ return x.id === c.getAttribute("data-wk-zd"); })[0]; if(!p) return;
      p.zeroDate = c.value; OPEN[a.id].s4 = true; H().save();
    }); });
    $("wkRankSave").addEventListener("click", function(){ a.rank = $("wkRank").value.trim(); a.rankDate = $("wkRankD").value; a.rankNext = $("wkRankN").value.trim(); OPEN[a.id].s5 = true; H().save(); H().toast("ランクを保存しました"); });
    $("wkInsAsk").addEventListener("click", function(){ copy(INSIGHT_ASK, "頼み方をコピーしました。Museに貼ってください"); });
    $("wkInsSave").addEventListener("click", function(){
      a.insight = $("wkIns").value; var n = parseInsight(a.insight).length; OPEN[a.id].s6 = true; H().save();
      H().toast(n ? n + "件の分析を取り込みました" : "数字の行が見つかりませんでした（形を確かめてください）");
    });
    $("wkConsult").addEventListener("click", function(){
      var t = "【相談】マネタイズ班アプリのアカウント「" + a.name + "」について\n" +
        "・テーマ：" + (a.theme || "未設定") + "\n・誰に・何を：" + (a.target || "未設定") + "\n" +
        "・ROOMのランク：" + (a.rank || "未入力") + (a.rankDate ? "（" + a.rankDate + " 確認）" : "") + "\n" +
        "・紹介する商品と反応：\n" + (rows.length ? rows.map(function(r){ return "  - " + r.p.name + "（" + r.p.status + "）クリック" + r.t.c + "・売上" + r.t.s + "円"; }).join("\n") : "  （まだなし）") + "\n" +
        "・Instagramの数字（貼った期間の合計）：再生" + tot.play + "・リーチ" + tot.reach + "・いいね" + tot.like + "・保存" + tot.save + "\n" +
        "・伸びている投稿：" + (top.length ? top.map(function(r){ return r.post + "（" + r.play + "）"; }).join("、") : "（データなし）") + "\n" +
        (a.insight && /[^\d,\s\-\/]/.test(a.insight) ? "・分析のメモ（貼ったもの）：\n" + a.insight.split(/\r?\n/).filter(function(l){ return !/^\d{4}[-\/]/.test(l.trim()); }).join("\n") + "\n" : "") +
        "\n相談したいこと：（ここに書く。例：次に紹介する商品は？ リールはどう作る？）";
      copy(t, "相談用にまとめてコピーしました。Museに貼ってください");
    });
  };
})();
