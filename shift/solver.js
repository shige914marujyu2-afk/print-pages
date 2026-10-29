/* シフト計算（焼きなまし法）。P = {N,nd,dow,hol:Set,fixed[i][d],prevRun[i],prevOff[i][7],mode,min,sp[i],names[i]} */
(function(root){
const PEN={staff:5000,run:2000,pair:1000,sp:1000,flex:2000,off3:30,iso:3,bal:1};
function weeksOf(P){const w=[];let s=1;while(s<=P.nd){let e=s;while(e<P.nd&&P.dow(e)!==6)e++;w.push([s,e]);s=e+1}return w}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function prepare(P){
 const {N,nd,dow,hol,fixed,prevOff,mode}=P;const weeks=weeksOf(P);const W=[];const notes=[];
 for(let i=0;i<N;i++){W[i]=[];weeks.forEach(([a,b],wi)=>{const len=b-a+1;const free=[];let fix=0;
  for(let d=a;d<=b;d++){if(fixed[i][d]){if(!(hol.has(d)&&mode==="B"))fix++;continue}free.push(d)}
  let lo,hi;
  if(len===7)lo=hi=2;
  else if(wi===0){let po=0;for(let q=len;q<7;q++)if(prevOff[i][q])po++;lo=hi=Math.max(0,2-po)}
  else{lo=Math.max(0,2-(7-len));hi=Math.min(2,len)}
  if(fix>hi)notes.push(`${P.names[i]}：${a}〜${b}日の週は希望休などで休みが${fix}日になります`);
  const flex=lo!==hi;const need=flex?null:Math.min(free.length,Math.max(0,lo-fix));
  W[i].push({a,b,free,need,flex,lo:Math.max(0,lo-fix),hi:Math.max(0,hi-fix),ideal:2*len/7-fix})})}
 return {W,notes,weeks}}
function solve(P,prep,seed,iters){
 const {N,nd,dow,hol,fixed,prevRun,min,sp}=P;const {W}=prep;const R=rng(seed);
 const isWD=d=>{const q=dow(d);return q>=1&&q<=5&&!hol.has(d)};
 const off=[];for(let i=0;i<N;i++){off[i]=new Uint8Array(nd+2);for(let d=1;d<=nd;d++)if(fixed[i][d])off[i][d]=1;
  for(const w of W[i]){const pool=w.free.slice();const n=w.flex?Math.round(Math.max(w.lo,Math.min(w.hi,w.ideal))):w.need;
   for(let k=0;k<n&&pool.length;k++){const j=Math.floor(R()*pool.length);off[i][pool[j]]=1;pool.splice(j,1)}}}
 const work=new Int16Array(nd+2);for(let d=1;d<=nd;d++){let c=0;for(let i=0;i<N;i++)if(!off[i][d])c++;work[d]=c}
 let wsum=0,wcnt=0;for(let d=1;d<=nd;d++)if(!hol.has(d)){wsum+=work[d];wcnt++}const avg=wcnt?wsum/wcnt:0;
 function pp(i){const o=off[i];let p=0,run=prevRun[i];
  for(let d=1;d<=nd;d++){if(o[d]){if(run>=4)p+=PEN.run*(run-3);run=0}else run++}if(run>=4)p+=PEN.run*(run-3);
  let pairs=0;for(let d=1;d<nd;d++)if(o[d]&&o[d+1]&&(!sp[i]||(isWD(d)&&isWD(d+1))))pairs++;if(!pairs)p+=PEN.pair;
  if(sp[i])for(const w of W[i]){let any=false,has=false;for(let d=w.a;d<=w.b;d++){const q=dow(d);if((q===2||q===3)&&!hol.has(d)){any=true;if(o[d])has=true}}if(any&&!has)p+=PEN.sp}
  for(const w of W[i])if(w.flex){let c=0;for(const d of w.free)if(o[d])c++;if(c<w.lo)p+=PEN.flex*(w.lo-c);if(c>w.hi)p+=PEN.flex*(c-w.hi);p+=20*Math.abs(c-w.ideal)}
  for(let d=1;d+2<=nd;d++)if(o[d]&&o[d+1]&&o[d+2]&&!(fixed[i][d]&&fixed[i][d+1]&&fixed[i][d+2]))p+=PEN.off3;
  for(let d=2;d<nd;d++)if(o[d-1]&&!o[d]&&o[d+1])p+=PEN.iso;
  return p}
 const dp=d=>hol.has(d)?0:PEN.staff*Math.max(0,min-work[d])+PEN.bal*(work[d]-avg)**2;
 const Pp=new Float64Array(N);let E=0;for(let i=0;i<N;i++){Pp[i]=pp(i);E+=Pp[i]}for(let d=1;d<=nd;d++)E+=dp(d);
 const slots=[];for(let i=0;i<N;i++)W[i].forEach(w=>{if(w.flex?w.free.length:(w.need>0&&w.need<w.free.length))slots.push([i,w])});
 let best=E,bestOff=off.map(x=>x.slice());if(!slots.length)return {off:bestOff,E:best};
 const T0=800,T1=0.5;const cool=Math.pow(T1/T0,1/iters);let T=T0;
 const accept=dE=>dE<=0||R()<Math.exp(-dE/T);
 const save=()=>{if(E<best-1e-9){best=E;bestOff=off.map(x=>x.slice())}};
 for(let it=0;it<iters;it++,T*=cool){const [i,w]=slots[Math.floor(R()*slots.length)];
  if(w.flex){const d=w.free[Math.floor(R()*w.free.length)];const v=off[i][d];const b0=Pp[i]+dp(d);off[i][d]=v^1;work[d]+=v?1:-1;const np=pp(i);const dE=np+dp(d)-b0;
   if(accept(dE)){Pp[i]=np;E+=dE;save()}else{off[i][d]=v;work[d]+=v?-1:1}continue}
  const on=[],of=[];for(const d of w.free)(off[i][d]?on:of).push(d);if(!on.length||!of.length)continue;
  const a=on[Math.floor(R()*on.length)],b=of[Math.floor(R()*of.length)];
  if(R()<0.5){// 2人で休みを交換（出勤人数は変わらない）
   const cand=[];for(let j=0;j<N;j++){if(j===i||fixed[j][a]||fixed[j][b])continue;if(!off[j][a]&&off[j][b])cand.push(j)}
   if(cand.length){const j=cand[Math.floor(R()*cand.length)];const b0=Pp[i]+Pp[j];
    off[i][a]=0;off[i][b]=1;off[j][a]=1;off[j][b]=0;const ni=pp(i),nj=pp(j);const dE=ni+nj-b0;
    if(accept(dE)){Pp[i]=ni;Pp[j]=nj;E+=dE;save()}else{off[i][a]=1;off[i][b]=0;off[j][a]=0;off[j][b]=1}continue}}
  const b0=Pp[i]+dp(a)+dp(b);off[i][a]=0;off[i][b]=1;work[a]++;work[b]--;const np=pp(i);const dE=np+dp(a)+dp(b)-b0;
  if(accept(dE)){Pp[i]=np;E+=dE;save()}else{off[i][a]=1;off[i][b]=0;work[a]--;work[b]++}}
 return {off:bestOff,E:best}}
function dist(a,b){let c=0;for(let i=0;i<a.length;i++)for(let d=1;d<a[i].length;d++)if(a[i][d]!==b[i][d])c++;return c}
function solvePlans(P,runs,iters){const prep=prepare(P);const res=[];const base=Date.now()%100000;
 for(let k=0;k<runs;k++)res.push(solve(P,prep,base+k*7919,iters));
 res.sort((x,y)=>x.E-y.E);const plans=[];
 for(const r of res){if(plans.length>=3)break;if(plans.every(p=>dist(p.off,r.off)>=16))plans.push(r)}
 for(const r of res){if(plans.length>=3)break;if(!plans.includes(r))plans.push(r)}
 return {plans,notes:prep.notes,W:prep.W}}
root.ShiftSolver={solvePlans,weeksOf};
})(typeof window!=="undefined"?window:globalThis);
