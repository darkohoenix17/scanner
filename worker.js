// SharpScan background worker (Cloudflare Workers, free plan)
// Needs: KV binding named KV, secret/variable named KEY (your password), cron trigger "* * * * *".
const TF=["1m","5m","15m","1h","4h","1d"],TFM={"1m":1,"5m":5,"15m":15,"1h":60,"4h":240,"1d":1440},HT={"1m":"15m","5m":"1h","15m":"1h","1h":"4h","4h":"1d","1d":null};
const NAMES={"GC=F":"Gold futures","SI=F":"Silver futures","PL=F":"Platinum","HG=F":"Copper","CL=F":"Crude oil","BZ=F":"Brent oil","NG=F":"Natural gas","ES=F":"S&P 500 futures","NQ=F":"Nasdaq futures","YM=F":"Dow futures","RTY=F":"Russell futures","^GSPC":"S&P 500","^IXIC":"Nasdaq","^DJI":"Dow Jones","^FTSE":"FTSE 100","^GDAXI":"DAX","^N225":"Nikkei 225","^HSI":"Hang Seng"};
const lab=s=>NAMES[s]||(/^[A-Z]{6}=X$/.test(s)?s.slice(0,3)+"/"+s.slice(3,6):s.replace(".P"," perp"));
const fx=p=>p>=100?p.toFixed(2):p>=10?p.toFixed(3):p>=1?p.toFixed(5):p.toFixed(6);
const ema=(a,n)=>{const k=2/(n+1);let e=a[0];return a.map((v,i)=>i?e=v*k+e*(1-k):e)};
function rsi(c,n=14){let g=0,l=0,o=50;for(let i=1;i<c.length;i++){const d=c[i]-c[i-1],G=Math.max(d,0),L=Math.max(-d,0);if(i<=n){g+=G/n;l+=L/n}else{g=(g*(n-1)+G)/n;l=(l*(n-1)+L)/n}o=l?100-100/(1+g/l):100}return o}
function atr(r,n=14){let a=0;for(let i=1;i<r.length;i++){const t=Math.max(r[i].h-r[i].l,Math.abs(r[i].h-r[i-1].c),Math.abs(r[i].l-r[i-1].c));a=i<=n?a+t/n:(a*(n-1)+t)/n}return a}
function sw(r){const H=[],L=[];for(let i=2;i<r.length-2;i++){const x=r[i];if([-2,-1,1,2].every(d=>r[i+d].h<x.h))H.push({i,p:x.h});if([-2,-1,1,2].every(d=>r[i+d].l>x.l))L.push({i,p:x.l})}return{H,L}}
function stack(r){if(!r||r.length<210)return 0;const c=r.map(x=>x.c),n=c.length-1,a=ema(c,20)[n],b=ema(c,50)[n],d=ema(c,200)[n],P=c[n];return P>b&&a>b&&b>d?1:P<b&&a<b&&b<d?-1:0}
function analyse(r,htf=0){
 if(!r||r.length<210)return null;const n=r.length-1,c=r.map(x=>x.c),P=c[n],A=atr(r),k=r[n],p=r[n-1],body=Math.abs(k.c-k.o),rg=k.h-k.l||1e-9;
 const e20=ema(c,20),e50=ema(c,50),e200=ema(c,200),m12=ema(c,12),m26=ema(c,26),ml=m12.map((v,i)=>v-m26[i]),sg=ema(ml,9),hs=ml.map((v,i)=>v-sg[i]),S=sw(r),V=[];
 const vt=(nm,w,v,t)=>V.push({nm,w,v,t});
 const st=P>e50[n]&&e20[n]>e50[n]&&e50[n]>e200[n]?1:P<e50[n]&&e20[n]<e50[n]&&e50[n]<e200[n]?-1:0;
 vt("Trend",1.5,st,st>0?"Trend: price above EMA20 > 50 > 200, a full bullish stack.":st<0?"Trend: price below EMA20 < 50 < 200, a full bearish stack.":"Trend: EMAs mixed, no clean trend.");
 const H=S.H.slice(-2),L=S.L.slice(-2);let sv=0,stx="Structure: swings mixed.";
 if(H.length==2&&L.length==2){if(H[1].p>H[0].p&&L[1].p>L[0].p){sv=1;stx="Structure: higher highs and higher lows."}else if(H[1].p<H[0].p&&L[1].p<L[0].p){sv=-1;stx="Structure: lower highs and lower lows."}}
 if(S.H.length&&P>S.H.at(-1).p){sv=1;stx="Structure: broke above the last swing high (break of structure)."}else if(S.L.length&&P<S.L.at(-1).p){sv=-1;stx="Structure: broke below the last swing low (break of structure)."}
 vt("Structure",1.5,sv,stx);
 const h=hs[n],hp=hs[n-1],mv=h>0?(h>=hp?1:.5):(h<=hp?-1:-.5);vt("Momentum",1,mv,mv>0?"Momentum: MACD histogram positive"+(mv==1?" and rising.":" but fading."):"Momentum: MACD histogram negative"+(mv==-1?" and falling.":" but recovering."));
 const w=c.slice(-20),mb=w.reduce((a,b)=>a+b)/20,sd=Math.sqrt(w.reduce((a,b)=>a+(b-mb)**2,0)/20),R=rsi(c);
 const rv=R<30&&P<=mb-2*sd?1:R>70&&P>=mb+2*sd?-1:R<35?.5:R>65?-.5:0;vt("Reversion",.5,rv,rv>0?"Mean reversion: RSI "+R.toFixed(0)+" oversold near the lower band.":rv<0?"Mean reversion: RSI "+R.toFixed(0)+" overbought near the upper band.":"Mean reversion: RSI "+R.toFixed(0)+", no stretch.");
 const pr=r.slice(-21,-1),hh=Math.max(...pr.map(x=>x.h)),ll=Math.min(...pr.map(x=>x.l)),bo=P>hh?1:P<ll?-1:0;vt("Breakout",1,bo,bo>0?"Breakout: closed above the 20-bar high.":bo<0?"Breakout: closed below the 20-bar low.":"Breakout: still inside the 20-bar range.");
 const sup=S.L.slice(-6).some(x=>Math.abs(P-x.p)<.6*A),res=S.H.slice(-6).some(x=>Math.abs(P-x.p)<.6*A),sr=sup&&k.c>k.o?1:res&&k.c<k.o?-1:0;vt("Support/Resistance",1,sr,sr>0?"Support: price bouncing off a previous swing low.":sr<0?"Resistance: price rejected at a previous swing high.":"Support/resistance: not at a key level.");
 const bullE=k.c>k.o&&p.c<p.o&&k.c>p.o&&k.o<p.c,bearE=k.c<k.o&&p.c>p.o&&k.c<p.o&&k.o>p.c,pb=Math.min(k.o,k.c)-k.l>2*body&&body/rg<.35,ps=k.h-Math.max(k.o,k.c)>2*body&&body/rg<.35,q2=r[n-2],ms=q2.c<q2.o&&Math.abs(p.c-p.o)<(q2.o-q2.c)*.4&&k.c>k.o&&k.c>(q2.o+q2.c)/2,es=q2.c>q2.o&&Math.abs(p.c-p.o)<(q2.c-q2.o)*.4&&k.c<k.o&&k.c<(q2.o+q2.c)/2;
 const cd=(bullE||pb||ms)?1:(bearE||ps||es)?-1:0;vt("Candles",1,cd,cd>0?"Candle pattern: "+(bullE?"bullish engulfing":ms?"morning star":"hammer/pin bar")+".":cd<0?"Candle pattern: "+(bearE?"bearish engulfing":es?"evening star":"shooting star/pin bar")+".":"Candle pattern: none on the last candle.");
 let fb=0;const lH=S.H.at(-1),lL=S.L.at(-1);if(lH&&lL&&lH.p>lL.p){const rgl=lH.p-lL.p;if(lL.i<lH.i){const rt=(lH.p-P)/rgl;if(rt>=.382&&rt<=.66)fb=1}else{const rt=(P-lL.p)/rgl;if(rt>=.382&&rt<=.66)fb=-1}}
 vt("Fibonacci",1,fb,fb>0?"Fibonacci: pulled back to the 38–66% zone of the last up-leg.":fb<0?"Fibonacci: bounced into the 38–66% zone of the last down-leg.":"Fibonacci: not in a retracement zone.");
 const hl=(i,x)=>{let a=-Infinity,b=Infinity;for(let j=i-x+1;j<=i;j++){if(r[j].h>a)a=r[j].h;if(r[j].l<b)b=r[j].l}return(a+b)/2},tk=hl(n,9),kj=hl(n,26),ci=n-26,sa=(hl(ci,9)+hl(ci,26))/2,sb=hl(ci,52),tp=Math.max(sa,sb),bt=Math.min(sa,sb);
 const ic=P>tp&&tk>kj?1:P<bt&&tk<kj?-1:P>tp?.5:P<bt?-.5:0;vt("Ichimoku",1,ic,ic>0?"Ichimoku: price above the cloud"+(tk>kj?" with Tenkan over Kijun.":"."):ic<0?"Ichimoku: price below the cloud"+(tk<kj?" with Tenkan under Kijun.":"."):"Ichimoku: price inside the cloud (indecision).");
 const av=r.slice(-21,-1).reduce((a,b)=>a+b.v,0)/20,vv=k.v&&av&&k.v>1.5*av?(k.c>k.o?.5:-.5):0;vt("Volume",.5,vv,vv?"Volume: spike of "+(k.v/av).toFixed(1)+"x average backing the move.":"Volume: normal or not available.");
 vt("Higher TF",1.5,htf,htf>0?"Higher timeframe trend is bullish.":htf<0?"Higher timeframe trend is bearish.":"Higher timeframe is neutral or unavailable.");
 const sc=V.reduce((a,x)=>a+x.w*x.v,0),dir=sc>0?1:-1,agree=V.filter(x=>x.v*dir>0).length,opp=V.filter(x=>x.v*dir<0).length,conf=Math.min(95,Math.round(Math.abs(sc)/8*100));
 let T=null;if(agree>=4&&opp<=2&&conf>=40){const lv=dir>0?S.L.at(-1):S.H.at(-1);let sl=dir>0?Math.min(lv?lv.p:P-2*A,P-A)-.3*A:Math.max(lv?lv.p:P+2*A,P+A)+.3*A;if(Math.abs(P-sl)>3*A)sl=P-dir*3*A;const rk=Math.abs(P-sl);T={dir,entry:P,sl,tp1:P+dir*1.5*rk,tp2:P+dir*3*rk}}
 return{sc,conf,V,agree,opp,T,P,grade:conf>=80?"A+":conf>=70?"A":conf>=60?"B+":"B",top:V.filter(x=>x.v*dir>0).sort((a,b)=>b.w*b.v*dir-a.w*a.v*dir).slice(0,3).map(x=>x.t)}}
const mk=(sym,tf,a)=>({sym,tf,...a.T,conf:a.conf,grade:a.grade,agree:a.agree,opp:a.opp,V:a.V,top:a.top,ts:Date.now()});
function plan(s){const B=s.dir>0,R=Math.abs(s.entry-s.sl),d=TFM[s.tf]*3,du=d>=1440?d/1440+"d":d>=60?d/60+"h":d+"m";
 return `⏱ WHEN: ${B?"Buy":"Sell"} now at market, or with a limit at ${fx(s.entry)}. Valid for about ${du} (3 candles).\n🚫 Skip it if price runs past ${fx(s.entry+s.dir*.5*R)} before you enter, or closes beyond the stop.\n🔁 At TP1 close half and move the stop to entry; let the rest run to TP2.\n💰 Risk 1% of your balance: lots = (1% of balance) ÷ (${fx(R)} × contract size).`}
function msgText(s,url){return `${s.dir>0?"🟢 BUY":"🔴 SELL"} ${lab(s.sym)} · ${s.tf}\nConfidence ${s.conf}% (${s.grade}) · ${s.agree}/11 methods agree\n\nEntry ${fx(s.entry)}\nStop loss ${fx(s.sl)}\nTP1 ${fx(s.tp1)} (1.5R)\nTP2 ${fx(s.tp2)} (3R)\n\n${plan(s)}\n\nWhy: ${s.top.join(" | ")}`+(url?`\n\nFull details: ${url}#${encodeURIComponent(s.sym+"|"+s.tf)}`:"")+"\n⚠️ Not financial advice."}

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(o,c=200)=>new Response(JSON.stringify(o),{status:c,headers:{...CORS,"Content-Type":"application/json"}});
const bk=a=>a.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}));
async function gj(u,h){const r=await fetch(u,h?{headers:h}:undefined);if(!r.ok)throw"HTTP "+r.status;return r.json()}
const YI={"1m":["1m","5d"],"5m":["5m","1mo"],"15m":["15m","1mo"],"1h":["60m","6mo"],"4h":["60m","1y"],"1d":["1d","2y"]};
function agg(d,n){const o=[];for(let i=d.length%n;i<d.length;i+=n){const g=d.slice(i,i+n);if(g.length<n)break;o.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((a,x)=>a+x.v,0)})}return o}
async function candles(sym,tf){
 if(!TFM[tf])throw"bad timeframe";
 if(/USDT(\.P)?$/.test(sym)){const b=sym.replace(".P","");
  if(sym.endsWith(".P"))return bk(await gj(`https://fapi.binance.com/fapi/v1/klines?symbol=${b}&interval=${tf}&limit=300`));
  try{return bk(await gj(`https://data-api.binance.vision/api/v3/klines?symbol=${b}&interval=${tf}&limit=300`))}catch{return bk(await gj(`https://api.binance.com/api/v3/klines?symbol=${b}&interval=${tf}&limit=300`))}}
 const[iv,rg]=YI[tf],j=await gj(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${iv}&range=${rg}`,{"User-Agent":"Mozilla/5.0"}),x=j.chart&&j.chart.result&&j.chart.result[0];
 if(!x)throw"No data for "+sym;const q=x.indicators.quote[0],t=x.timestamp,d=[];
 for(let i=0;i<t.length;i++)if(q.close[i]!=null&&q.open[i]!=null)d.push({t:t[i]*1000,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]||0});
 return(tf==="4h"?agg(d,4):d).slice(-300)}
async function tgSend(c,text){if(!c.tgT||!c.tgC)return false;try{const r=await fetch(`https://api.telegram.org/bot${c.tgT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:c.tgC,text,disable_web_page_preview:true})});return(await r.json()).ok}catch{return false}}
const getCfg=async env=>JSON.parse(await env.KV.get("cfg")||"null");
const getSt=async env=>JSON.parse(await env.KV.get("state")||'{"setups":{},"alerts":{}}');
async function scan(env){
 const c=await getCfg(env);if(!c||!c.watch||!c.watch.length||!c.tfs||!c.tfs.length)return;
 const pairs=c.watch.flatMap(s=>c.tfs.map(t=>[s,t])),per=12,slot=Math.floor(Date.now()/60000),n=Math.min(per,pairs.length),start=(slot*per)%pairs.length,now=Date.now();
 const st=await getSt(env);let dirty=false;const cm=new Map(),gc=(s,t)=>{const k=s+t;if(!cm.has(k))cm.set(k,candles(s,t));return cm.get(k)};
 for(let i=0;i<n;i++){const[sym,tf]=pairs[(start+i)%pairs.length],key=sym+"|"+tf;
  try{let r=await gc(sym,tf);if(r.length&&r.at(-1).t+TFM[tf]*60000>now)r=r.slice(0,-1);let ht=0;if(HT[tf]){try{ht=stack(await gc(sym,HT[tf]))}catch{}}
   const a=analyse(r,ht);
   if(a&&a.T&&a.conf>=(c.minConf||60)){const s=mk(sym,tf,a),o=st.setups[key];
    if(!o||o.dir!==s.dir||Math.abs(o.conf-s.conf)>=5){st.setups[key]=o&&o.dir===s.dir?{...s,ts:o.ts}:s;dirty=true}
    const ak=key+s.dir;if(now-(st.alerts[ak]||0)>(c.cool||60)*60000){st.alerts[ak]=now;dirty=true;await tgSend(c,msgText(s,c.appUrl))}}
   else if(st.setups[key]){delete st.setups[key];dirty=true}
  }catch(e){}}
 for(const k in st.setups){const s=st.setups[k];if(now-s.ts>Math.max(3*TFM[s.tf],60)*60000){delete st.setups[k];dirty=true}}
 for(const k in st.alerts)if(now-st.alerts[k]>2*864e5){delete st.alerts[k];dirty=true}
 if(dirty)await env.KV.put("state",JSON.stringify(st));
 if(slot%10===0)await env.KV.put("run",String(now))}
export default{
 async fetch(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{headers:CORS});
  if(!env.KEY||req.headers.get("x-key")!==env.KEY)return J({error:"Wrong password"},401);
  if(!env.KV)return J({error:"KV storage is not bound to the worker"},500);
  try{
   if(u.pathname==="/candles")return J(await candles(u.searchParams.get("s"),u.searchParams.get("tf")));
   if(u.pathname==="/ping"){const c=await getCfg(env);return J({ok:true,watch:c?c.watch.length:0,tfs:c?c.tfs:[],run:+(await env.KV.get("run")||0),telegram:!!(c&&c.tgT&&c.tgC)})}
   if(u.pathname==="/setups"){const st=await getSt(env),c=await getCfg(env);return J({setups:Object.values(st.setups).sort((a,b)=>b.conf-a.conf),watch:c?c.watch.length:0,tfs:c?c.tfs:[],run:+(await env.KV.get("run")||0)})}
   if(u.pathname==="/config"&&req.method==="POST"){const b=await req.json();const c={watch:(b.watch||[]).slice(0,300).map(String),tfs:(b.tfs||[]).filter(t=>TFM[t]),minConf:+b.minConf||60,cool:+b.cool||60,tgT:String(b.tgT||""),tgC:String(b.tgC||""),appUrl:String(b.appUrl||"")};await env.KV.put("cfg",JSON.stringify(c));return J({ok:true,pairs:c.watch.length*c.tfs.length})}
   if(u.pathname==="/test"){const c=await getCfg(env);return J({ok:await tgSend(c||{},"✅ SharpScan background scanner is connected. Setups will arrive here.")})}
   if(u.pathname==="/scan-now"){await scan(env);return J({ok:true})}
   return J({error:"Not found"},404)}catch(e){return J({error:String(e)},500)}},
 async scheduled(ev,env,ctx){ctx.waitUntil(scan(env))}}
