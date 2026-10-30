/* シフト計算
 P = {N,nd,dow,hol:Set(公休),shuku:Set(祝日),busy:Set(金土日祝),fixed[i][d],prevRun[i],prevOff[i][7],prevKnown[i],mode,
      cfg:{min,wdMax,beTarget,beMax,weekOff,maxRun,minPairs,tri},offDows[i],wdPair[i],names[i],pastPairs[i],pastTri[i]} */
(function(root){
const STYLE={
 A:{label:"A案",desc:"飛び石の休み（休→出→休）を作らず、休みをまとめる",iso:400,pair2:150,tri:400,busy:300,quiet:20},
 B:{label:"B案",desc:"金・土・日・祝日の出勤人数を最優先（飛び石の休みもあり）",iso:2,pair2:40,tri:250,busy:900,quiet:60}};
const PEN={staff:20000,run:3000,pair:3000,dowp:2000,flex:2000,off3:30,wdp:40};
function weeksOf(P){const w=[];let s=1;while(s<=P.nd){let e=s;while(e<P.nd&&P.dow(e)!==6)e++;w.push([s,e]);s=e+1}return w}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function dayRange(P,d){const c=P.cfg;if(P.hol.has(d))return null;const b=P.busy.has(d);return {lo:c.min,hi:b?c.beMax:c.wdMax,target:b?c.beTarget:null,busy:b}}
const isWDf=P=>d=>{const q=P.dow(d);return q>=1&&q<=5&&!P.hol.has(d)&&!P.shuku.has(d)};
/* 休みのかたまり（連続した休み）を調べる */
function blocks(o,nd){const r=[];let s=0;for(let d=1;d<=nd+1;d++){if(d<=nd&&o[d]){if(!s)s=d}else if(s){r.push([s,d-1]);s=0}}return r}
function stats(P,i,o){const isWD=isWDf(P);let pairs=0,tri=0,badPair=0;
 for(const [a,b] of blocks(o,P.nd)){const L=b-a+1;if(L<2)continue;
  let allWD=true,hasHol=false;for(let d=a;d<=b;d++){if(!isWD(d))allWD=false;if(P.hol.has(d))hasHol=true}
  if(P.wdPair[i]){if(allWD)pairs++;else badPair++}else{pairs++;if(L>=3&&hasHol)tri++}}
 return {pairs,tri,badPair}}
function prepare(P){
 const {N,hol,fixed,prevOff,prevKnown,mode,cfg}=P;const K=cfg.weekOff;const weeks=weeksOf(P);const W=[];const notes=[];
 for(let i=0;i<N;i++){W[i]=[];weeks.forEach(([a,b],wi)=>{const len=b-a+1;const free=[];let fix=0;
  for(let d=a;d<=b;d++){if(fixed[i][d]){if(!(hol.has(d)&&mode==="B"))fix++;continue}free.push(d)}
  let lo,hi;
  if(len===7)lo=hi=K;
  else if(wi===0&&prevKnown[i]){let po=0;for(let q=len;q<7;q++)if(prevOff[i][q])po++;lo=hi=Math.max(0,K-po)}
  else{lo=Math.max(0,K-(7-len));hi=Math.min(K,len)}
  if(fix>hi)notes.push(`${P.names[i]}：${a}〜${b}日の週は希望休などで休みが${fix}日になります`);
  const flex=lo!==hi;const need=flex?null:Math.min(free.length,Math.max(0,lo-fix));
  W[i].push({a,b,free,need,flex,lo:Math.max(0,lo-fix),hi:Math.max(0,hi-fix),ideal:K*len/7-fix})})}
 const fairOf=arr=>{const mx=Math.max(0,...arr.map(v=>v||0));return arr.map(v=>1+(mx-(v||0)))};
 return {W,notes,weeks,fair:fairOf(P.pastPairs||[]),fair3:fairOf(P.pastTri||[])}}
function solve(P,prep,st,seed,iters,opt={}){
 const H=opt.hardMul||1;const PN={};for(const k in PEN)PN[k]=PEN[k]*(k==="off3"||k==="wdp"?1:H);
 const {N,nd,dow,hol,fixed,prevRun,cfg,offDows,wdPair}=P;const {W,fair,fair3}=prep;const R=rng(seed);
 const off=[];
 if(opt.init){for(let i=0;i<N;i++)off[i]=opt.init[i].slice()}
 else for(let i=0;i<N;i++){off[i]=new Uint8Array(nd+2);for(let d=1;d<=nd;d++)if(fixed[i][d])off[i][d]=1;
  for(const w of W[i]){const pool=w.free.slice();const n=w.flex?Math.round(Math.max(w.lo,Math.min(w.hi,w.ideal))):w.need;
   for(let k=0;k<n&&pool.length;k++){const j=Math.floor(R()*pool.length);off[i][pool[j]]=1;pool.splice(j,1)}}}
 const work=new Int16Array(nd+2);for(let d=1;d<=nd;d++){let c=0;for(let i=0;i<N;i++)if(!off[i][d])c++;work[d]=c}
 const RG=[];for(let d=1;d<=nd;d++)RG[d]=dayRange(P,d);
 function pp(i){const o=off[i];let p=0,run=prevRun[i];
  for(let d=1;d<=nd;d++){if(o[d]){if(run>cfg.maxRun)p+=PN.run*(run-cfg.maxRun);run=0}else run++}if(run>cfg.maxRun)p+=PN.run*(run-cfg.maxRun);
  const s=stats(P,i,o);
  if(s.pairs<cfg.minPairs)p+=PN.pair*(cfg.minPairs-s.pairs);else if(s.pairs>cfg.minPairs)p-=st.pair2*fair[i];
  p+=PN.wdp*s.badPair;
  if(cfg.tri&&!wdPair[i]){if(s.tri>=1)p-=st.tri*fair3[i];if(s.tri>=2)p-=st.tri*0.3*fair3[i]}
  for(const [a,b] of blocks(o,nd)){const L=b-a+1;if(L<3)continue;let allFix=true,hasHol=false;for(let d=a;d<=b;d++){if(!fixed[i][d])allFix=false;if(hol.has(d))hasHol=true}
   if(allFix)continue;if(!hasHol||!cfg.tri)p+=PN.off3*(L-2);else if(L>3)p+=PN.off3*(L-3)}
  if(offDows[i]&&offDows[i].length)for(const w of W[i]){let any=false,has=false;for(let d=w.a;d<=w.b;d++){if(offDows[i].includes(dow(d))&&!hol.has(d)){any=true;if(o[d])has=true}}if(any&&!has)p+=PN.dowp}
  for(const w of W[i])if(w.flex){let c=0;for(const d of w.free)if(o[d])c++;if(c<w.lo)p+=PN.flex*(w.lo-c);if(c>w.hi)p+=PN.flex*(c-w.hi);p+=20*Math.abs(c-w.ideal)}
  for(let d=2;d<nd;d++)if(o[d-1]&&!o[d]&&o[d+1]&&!(fixed[i][d-1]&&fixed[i][d+1]))p+=st.iso;
  if(opt.ref){const rf=opt.ref[i];let c=0;for(let d=1;d<=nd;d++)if(o[d]!==rf[d])c++;p-=opt.div*Math.min(c,8)}
  return p}
 const dp=d=>{const r=RG[d];if(!r)return 0;const w=work[d];const sh=Math.max(0,r.lo-w),ov=Math.max(0,w-r.hi);let p=PN.staff*(sh*sh+ov*ov);
  if(r.busy)p+=st.busy*Math.max(0,r.target-w)+5*Math.max(0,r.hi-w);else p+=st.quiet*Math.max(0,w-r.lo);return p};
 const Pp=new Float64Array(N);let E=0;for(let i=0;i<N;i++){Pp[i]=pp(i);E+=Pp[i]}for(let d=1;d<=nd;d++)E+=dp(d);
 const slots=[];for(let i=0;i<N;i++)W[i].forEach(w=>{if(w.flex?w.free.length:(w.need>0&&w.need<w.free.length))slots.push([i,w])});
 let best=E,bestOff=off.map(x=>x.slice());if(!slots.length)return {off:bestOff,E:best};
 const byP=[];for(const sl of slots)(byP[sl[0]]||(byP[sl[0]]=[])).push(sl);
 const pick=()=>{if(R()<0.5){const bad=[];for(let q=0;q<N;q++)if(byP[q]&&Pp[q]>=1000)bad.push(q);if(bad.length){const q=bad[Math.floor(R()*bad.length)];return byP[q][Math.floor(R()*byP[q].length)]}}return slots[Math.floor(R()*slots.length)]};
 const T0=opt.T0||2000,T1=opt.T1||1;const cool=Math.pow(T1/T0,1/iters);let T=T0;
 const accept=dE=>dE<=0||R()<Math.exp(-dE/T);
 const save=()=>{if(E<best-1e-9){best=E;bestOff=off.map(x=>x.slice())}};
 for(let it=0;it<iters;it++,T*=cool){const [i,w]=pick();
  if(w.flex){const d=w.free[Math.floor(R()*w.free.length)];const v=off[i][d];const b0=Pp[i]+dp(d);off[i][d]=v^1;work[d]+=v?1:-1;const np=pp(i);const dE=np+dp(d)-b0;
   if(accept(dE)){Pp[i]=np;E+=dE;save()}else{off[i][d]=v;work[d]+=v?-1:1}continue}
  const on=[],of=[];for(const d of w.free)(off[i][d]?on:of).push(d);if(!on.length||!of.length)continue;
  const a=on[Math.floor(R()*on.length)],b=of[Math.floor(R()*of.length)];
  if(R()<0.5){const cand=[];for(let j=0;j<N;j++){if(j===i||fixed[j][a]||fixed[j][b])continue;if(!off[j][a]&&off[j][b])cand.push(j)}
   if(cand.length){const j=cand[Math.floor(R()*cand.length)];const b0=Pp[i]+Pp[j];
    off[i][a]=0;off[i][b]=1;off[j][a]=1;off[j][b]=0;const ni=pp(i),nj=pp(j);const dE=ni+nj-b0;
    if(accept(dE)){Pp[i]=ni;Pp[j]=nj;E+=dE;save()}else{off[i][a]=1;off[i][b]=0;off[j][a]=0;off[j][b]=1}continue}}
  const b0=Pp[i]+dp(a)+dp(b);off[i][a]=0;off[i][b]=1;work[a]++;work[b]--;const np=pp(i);const dE=np+dp(a)+dp(b)-b0;
  if(accept(dE)){Pp[i]=np;E+=dE;save()}else{off[i][a]=1;off[i][b]=0;work[a]--;work[b]++}}
 return {off:bestOff,E:best}}
/* 守れていないルールの数（人数・連勤・連休・個人の曜日） */
function hardViol(P,prep,off){const {N,nd,dow,hol,prevRun,cfg,offDows}=P;let v=0;
 for(let d=1;d<=nd;d++){const r=dayRange(P,d);if(!r)continue;let c=0;for(let i=0;i<N;i++)if(!off[i][d])c++;if(c<r.lo)v+=r.lo-c;if(c>r.hi)v+=c-r.hi}
 for(let i=0;i<N;i++){let run=prevRun[i];for(let d=1;d<=nd;d++){run=off[i][d]?0:run+1;if(run>cfg.maxRun)v++}
  if(stats(P,i,off[i]).pairs<cfg.minPairs)v++;
  if(offDows[i]&&offDows[i].length)for(const w of prep.W[i]){let any=false,has=false;for(let d=w.a;d<=w.b;d++){if(offDows[i].includes(dow(d))&&!hol.has(d)){any=true;if(off[i][d])has=true}}if(any&&!has)v++}}
 return v}
/* 1段目（正確な計算）：HiGHSでルールを守れる表を探す */
function buildLean(P,prep){const {N,nd,dow,hol,fixed,prevRun,cfg,offDows,wdPair}=P;const X=(i,d)=>`x${i}_${d}`;const isWD=isWDf(P);
 const cons=[],bin=[],cont=[],obj=[];let k=0;const sl=w=>{const v="s"+(k++);cont.push(v);obj.push(`${w} ${v}`);return v};
 for(let i=0;i<N;i++){for(let d=1;d<=nd;d++){bin.push(X(i,d));if(fixed[i][d])cons.push(`${X(i,d)} = 1`)}
  for(const w of prep.W[i]){if(!w.free.length)continue;const t=w.free.map(d=>X(i,d)).join(" + ");
   if(w.flex){cons.push(`${t} >= ${Math.min(w.lo,w.free.length)}`);cons.push(`${t} <= ${w.hi}`)}else cons.push(`${t} = ${w.need}`)}
  const K=cfg.maxRun+1,r=prevRun[i];
  for(let s0=2-K;s0+K-1<=nd;s0++){if(s0<1&&r<1-s0)continue;const ds=[];for(let d=Math.max(1,s0);d<=s0+K-1;d++)ds.push(X(i,d));cons.push(`${ds.join(" + ")} + ${sl(10)} >= 1`)}
  const ys=[];for(let d=1;d<nd;d++){if(wdPair[i]&&!(isWD(d)&&isWD(d+1)))continue;const y=`y${i}_${d}`;bin.push(y);ys.push(y);cons.push(`${y} - ${X(i,d)} <= 0`);cons.push(`${y} - ${X(i,d+1)} <= 0`)}
  if(cfg.minPairs>0)cons.push(`${ys.length?ys.join(" + ")+" + ":""}${sl(8)} >= ${cfg.minPairs}`);
  if(offDows[i]&&offDows[i].length)for(const w of prep.W[i]){const t=[];for(let d=w.a;d<=w.b;d++)if(offDows[i].includes(dow(d))&&!hol.has(d))t.push(X(i,d));if(t.length)cons.push(`${t.join(" + ")} + ${sl(6)} >= 1`)}}
 for(let d=1;d<=nd;d++){const rg=dayRange(P,d);if(!rg)continue;const t=[];for(let i=0;i<N;i++)t.push(X(i,d));const e=t.join(" + ");
  cons.push(`${e} - ${sl(100)} <= ${N-rg.lo}`);cons.push(`${e} + ${sl(100)} >= ${Math.max(0,N-rg.hi)}`);
  if(rg.busy&&rg.target>rg.lo)cons.push(`${e} - ${sl(1)} <= ${Math.max(0,N-rg.target)}`)}
 return `Minimize\n obj: ${obj.length?obj.join(" + "):"0 x0_1"}\nSubject To\n${cons.map((c,j)=>` c${j}: ${c}`).join("\n")}\nBounds\n${cont.map(v=>` 0 <= ${v}`).join("\n")}\nBinary\n ${bin.join(" ")}\nEnd\n`}
async function exactBase(P,prep,highs,limitSec){const lp=buildLean(P,prep);let r;
 try{r=highs.solve(lp,{time_limit:limitSec})}catch(e){return null}
 if(!r||!r.Columns||!/Optimal|Time limit|Feasible|Solution limit/i.test(r.Status))return null;
 const off=[];for(let i=0;i<P.N;i++){off[i]=new Uint8Array(P.nd+2);for(let d=1;d<=P.nd;d++){const c=r.Columns[`x${i}_${d}`];off[i][d]=c&&c.Primal>0.5?1:0}}
 return {off,E:0}}
/* A案・B案を作る */
async function solvePlans(P,onProgress,highs,limit=12000){const prep=prepare(P);let seed=Date.now()%100000;
 const HARD={iso:0,pair2:0,tri:0,busy:30,quiet:2};const tick=()=>new Promise(r=>setTimeout(r,30));
 onProgress&&onProgress("ルールを守れる組み合わせ");await tick();let base=null;
 if(highs){base=await exactBase(P,prep,highs,Math.round(limit/1000));if(base)base.hard=hardViol(P,prep,base.off)}
 if(!base||base.hard>0){const t0=Date.now();let iters=800000;
  while(true){await tick();const t1=Date.now();const r=solve(P,prep,HARD,seed+=7919,iters);r.hard=hardViol(P,prep,r.off);const dur=Date.now()-t1;
   if(!base||r.hard<base.hard)base=r;iters=Math.min(iters*2,3000000);
   if(base.hard===0||Date.now()-t0+dur*2>limit)break}}
 const plans=[];
 for(const key of ["A","B"]){const st=STYLE[key];onProgress&&onProgress(st.label);await tick();let best=null;
  const ex=key==="B"&&plans[0]?{ref:plans[0].off,div:60}:{};
  for(let k=0;k<3;k++){const r=solve(P,prep,st,seed+=7919,700000,{init:base.off,T0:150,T1:0.3,hardMul:10,...ex});r.hard=hardViol(P,prep,r.off);
   if(!best||r.hard<best.hard||(r.hard===best.hard&&r.E<best.E))best=r}
  if(best.hard>base.hard)best={...base};
  plans.push({...best,key,label:st.label,desc:st.desc})}
 return {plans,notes:prep.notes,W:prep.W}}
/* 連休・3連休の回数（offs＝休みの日の配列、hol＝公休の配列） */
function countBlocks(offs,hol){const s=new Set(offs),h=new Set(hol||[]);let pairs=0,tri=0;
 for(const d of s){if(s.has(d-1))continue;let e=d;while(s.has(e+1))e++;const L=e-d+1;if(L>=2)pairs++;if(L>=3){for(let x=d;x<=e;x++)if(h.has(x)){tri++;break}}}
 return {pairs,tri}}
root.ShiftSolver={solvePlans,hardViol,solve,prepare,weeksOf,countBlocks,stats,dayRange,STYLE};
})(typeof window!=="undefined"?window:globalThis);
