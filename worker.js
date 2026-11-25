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
 return{sc,conf,V,agree,opp,T,P,adx:adx(r),vp:atrPct(r),ct:k.t,hv:htf,grade:conf>=80?"A+":conf>=70?"A":conf>=60?"B+":"B",top:V.filter(x=>x.v*dir>0).sort((a,b)=>b.w*b.v*dir-a.w*a.v*dir).slice(0,3).map(x=>x.t)}}
function adx(r,n=14){const L=r.length;if(L<2*n+2)return 0;let tr=0,pd=0,md=0;const T=i=>Math.max(r[i].h-r[i].l,Math.abs(r[i].h-r[i-1].c),Math.abs(r[i].l-r[i-1].c)),U=i=>r[i].h-r[i-1].h,D=i=>r[i-1].l-r[i].l;
 for(let i=1;i<=n;i++){tr+=T(i);const u=U(i),d=D(i);pd+=u>d&&u>0?u:0;md+=d>u&&d>0?d:0}
 const dx=[];for(let i=n+1;i<L;i++){const u=U(i),d=D(i);tr=tr-tr/n+T(i);pd=pd-pd/n+(u>d&&u>0?u:0);md=md-md/n+(d>u&&d>0?d:0);const a=100*pd/tr,b=100*md/tr;dx.push(100*Math.abs(a-b)/((a+b)||1))}
 let a=dx.slice(0,n).reduce((s,x)=>s+x,0)/n;for(let i=n;i<dx.length;i++)a=(a*(n-1)+dx[i])/n;return a}
function atrPct(r){let a=0;const s=[];for(let i=1;i<r.length;i++){const t=Math.max(r[i].h-r[i].l,Math.abs(r[i].h-r[i-1].c),Math.abs(r[i].l-r[i-1].c));a=i<=14?a+t/14:(a*13+t)/14;if(i>=14)s.push(a)}const w=s.slice(-100),x=w[w.length-1];return 100*w.filter(v=>v<=x).length/w.length}
const mk=(sym,tf,a)=>({sym,tf,...a.T,conf:a.conf,grade:a.grade,agree:a.agree,opp:a.opp,V:a.V,top:a.top,adx:a.adx,vp:a.vp,ct:a.ct,hv:a.hv,ts:Date.now()});
// ---- filters shared by live scanning and backtests
function filt(a,f,tf){if(!f)return null;if(a.agree<(f.agree||4))return"only "+a.agree+" methods agree";
 if(f.htf&&!(a.hv*a.dir>0))return"higher timeframe does not agree";
 if(f.adx&&a.adx<f.adx)return"market is choppy (ADX "+a.adx.toFixed(0)+")";
 if(f.vp&&a.vp<f.vp)return"volatility too low";
 if(f.h1!=null&&f.h2!=null&&f.h1!==f.h2&&tf!=="1d"){const h=new Date(a.ct).getUTCHours(),ok=f.h1<f.h2?(h>=f.h1&&h<f.h2):(h>=f.h1||h<f.h2);if(!ok)return"outside the trading session"}
 return null}
// ---- backtesting (entry on the NEXT candle's open, stop checked before targets, costs included)
const BO={t1:1.5,t2:3,max:60,cost:.08};
function sim(r,j,dir,R,o){const e=r[j].o,sl=e-dir*R,t1=e+dir*o.t1*R,t2=e+dir*o.t2*R;let half=false,res=0;
 for(let k=j;k<r.length&&k<j+o.max;k++){const x=r[k],bars=k-j+1,be=dir>0?x.l<=e:x.h>=e,h2=dir>0?x.h>=t2:x.l<=t2;
  if(!half){if(dir>0?x.l<=sl:x.h>=sl)return{R:-1-o.cost,bars,out:"stop"};
   if(dir>0?x.h>=t1:x.l<=t1){half=true;res=.5*o.t1;if(be)return{R:res-o.cost,bars,out:"tp1+be"};if(h2)return{R:res+.5*o.t2-o.cost,bars,out:"tp2"}}}
  else{if(be)return{R:res-o.cost,bars,out:"tp1+be"};if(h2)return{R:res+.5*o.t2-o.cost,bars,out:"tp2"}}}
 if(j+o.max>r.length)return null;const x=r[j+o.max-1],p=(x.c-e)*dir/R;return{R:(half?res+.5*p:p)-o.cost,bars:o.max,out:"time"}}
async function signals(r,hr,tf){const out=[],W=300,ht=HT[tf];let hi=-1,hv=0,last=-2;
 for(let i=210;i<r.length-1;i++){const T=r[i].t+TFM[tf]*6e4;
  if(hr&&ht){while(hi+1<hr.length&&hr[hi+1].t+TFM[ht]*6e4<=T)hi++;if(hi!==last){last=hi;hv=hi>=209?stack(hr.slice(Math.max(0,hi-299),hi+1)):0}}
  const a=analyse(r.slice(Math.max(0,i-W+1),i+1),hv);if(a&&a.T)out.push({i,dir:a.T.dir,conf:a.conf,agree:a.agree,hv,adx:a.adx,vp:a.vp,ct:a.ct,R:Math.abs(a.T.entry-a.T.sl)});
  if(i%80===0)await new Promise(q=>setTimeout(q,0))}return out}
function runBT(recs,r,f,tf,o){o=o||BO;const t=[];let busy=-1;for(const s of recs){if(s.i<busy||s.conf<(f.conf||0)||filt(s,f,tf))continue;const x=sim(r,s.i+1,s.dir,s.R,o);if(!x)continue;t.push({i:s.i,R:x.R,out:x.out,dir:s.dir,ct:s.ct});busy=s.i+1+x.bars}return t}
function stats(t){const n=t.length;if(!n)return{n:0,w:0,e:0,pf:0,sum:0,dd:0,ls:0};let sum=0,pk=0,dd=0,w=0,gw=0,gl=0,ls=0,cl=0;for(const x of t){sum+=x.R;if(x.R>0){w++;gw+=x.R;cl=0}else{gl-=x.R;cl++;ls=Math.max(ls,cl)}pk=Math.max(pk,sum);dd=Math.max(dd,pk-sum)}return{n,w:Math.round(w/n*100),e:+(sum/n).toFixed(2),pf:gl?+(gw/gl).toFixed(2):(gw?99:0),sum:+sum.toFixed(1),dd:+dd.toFixed(1),ls}}
function plan(s){const B=s.dir>0,R=Math.abs(s.entry-s.sl),d=TFM[s.tf]*3,du=d>=1440?d/1440+"d":d>=60?d/60+"h":d+"m";
 return `⏱ WHEN: ${B?"Buy":"Sell"} now at market, or with a limit at ${fx(s.entry)}. Valid for about ${du} (3 candles).\n🚫 Skip it if price runs past ${fx(s.entry+s.dir*.5*R)} before you enter, or closes beyond the stop.\n🔁 At TP1 close half and move the stop to entry; let the rest run to TP2.\n💰 Risk 1% of your balance: lots = (1% of balance) ÷ (${fx(R)} × contract size).`}
function msgText(s,url,bt){return `${s.dir>0?"🟢 BUY":"🔴 SELL"} ${lab(s.sym)} · ${s.tf}\nConfidence ${s.conf}% (${s.grade}) · ${s.agree}/11 methods agree\n\nEntry ${fx(s.entry)}\nStop loss ${fx(s.sl)}\nTP1 ${fx(s.tp1)} (1.5R)\nTP2 ${fx(s.tp2)} (3R)\n\n${plan(s)}${bt&&bt.n?`\n\n📊 Backtest on this market: ${bt.w}% wins, avg ${bt.e>=0?"+":""}${bt.e}R per trade, profit factor ${bt.pf} (${bt.n} trades)`:""}\n\nWhy: ${s.top.join(" | ")}`+(url?`\n\nFull details: ${url}#${encodeURIComponent(s.sym+"|"+s.tf)}`:"")+"\n⚠️ Not financial advice."}

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(o,c=200)=>new Response(JSON.stringify(o),{status:c,headers:{...CORS,"Content-Type":"application/json"}});
const bk=a=>a.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}));
async function gj(u,h){const r=await fetch(u,h?{headers:h}:undefined);if(!r.ok)throw"HTTP "+r.status;return r.json()}
const BYI={"1m":"1","5m":"5","15m":"15","1h":"60","4h":"240","1d":"D"};
async function bybit(sym,tf,cat){const j=await gj(`https://api.bybit.com/v5/market/kline?category=${cat}&symbol=${sym}&interval=${BYI[tf]}&limit=300`);if(!j.result||!j.result.list||!j.result.list.length)throw"x";return j.result.list.slice().reverse().map(k=>({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}))}
const YD={"1m":["1m","7d"],"5m":["5m","60d"],"15m":["15m","60d"],"1h":["60m","2y"],"4h":["60m","2y"],"1d":["1d","10y"]};
async function deepBin(sym,tf){const fut=sym.endsWith(".P"),b=sym.replace(".P",""),bases=fut?["https://fapi.binance.com/fapi/v1/klines"]:["https://data-api.binance.vision/api/v3/klines","https://api.binance.com/api/v3/klines"];let out=[],end=Date.now();
 for(let p=0;p<4;p++){let j=null;for(const base of bases){try{j=await gj(`${base}?symbol=${b}&interval=${tf}&limit=1000&endTime=${end}`);break}catch{}}if(!j||!j.length)break;out=bk(j).concat(out);end=j[0][0]-1;if(j.length<1000)break}
 if(!out.length)throw"No data";return out}
const YI={"1m":["1m","5d"],"5m":["5m","1mo"],"15m":["15m","1mo"],"1h":["60m","6mo"],"4h":["60m","1y"],"1d":["1d","2y"]};
function agg(d,n){const o=[];for(let i=d.length%n;i<d.length;i+=n){const g=d.slice(i,i+n);if(g.length<n)break;o.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((a,x)=>a+x.v,0)})}return o}
async function candlesDef(sym,tf,deep){
 if(!TFM[tf])throw"bad timeframe";
 if(deep&&/USDT(\.P)?$/.test(sym))return deepBin(sym,tf);
 if(/USDT(\.P)?$/.test(sym)){const b=sym.replace(".P","");
  if(sym.endsWith(".P")){try{return bk(await gj(`https://fapi.binance.com/fapi/v1/klines?symbol=${b}&interval=${tf}&limit=300`))}catch{return bybit(b,tf,"linear")}}
  for(const u of[`https://data-api.binance.vision/api/v3/klines?symbol=${b}&interval=${tf}&limit=300`,`https://api.binance.com/api/v3/klines?symbol=${b}&interval=${tf}&limit=300`]){try{return bk(await gj(u))}catch{}}
  return bybit(b,tf,"spot")}
 const[iv,rg]=(deep?YD:YI)[tf],j=await gj(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${iv}&range=${rg}`,{"User-Agent":"Mozilla/5.0"}),x=j.chart&&j.chart.result&&j.chart.result[0];
 if(!x)throw"No data for "+sym;const q=x.indicators.quote[0],t=x.timestamp,d=[];
 for(let i=0;i<t.length;i++)if(q.close[i]!=null&&q.open[i]!=null)d.push({t:t[i]*1000,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]||0});
 return(tf==="4h"?agg(d,4):d).slice(deep?-5000:-300)}
async function tgSend(c,text){if(!c.tgT||!c.tgC)return false;try{const r=await fetch(`https://api.telegram.org/bot${c.tgT}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:c.tgC,text,disable_web_page_preview:true})});return(await r.json()).ok}catch{return false}}

// ---- MT5 via MetaApi (cloud, no PC needed)
const MAPD={"GC=F":"XAUUSD","SI=F":"XAGUSD","CL=F":"USOIL","BZ=F":"UKOIL","NG=F":"NATGAS","ES=F":"US500","NQ=F":"NAS100","YM=F":"US30","RTY=F":"US2000","^GSPC":"US500","^IXIC":"NAS100","^DJI":"US30","^FTSE":"UK100","^GDAXI":"GER40","^N225":"JP225","^HSI":"HK50","PAXGUSDT":"XAUUSD","XAUTUSDT":"XAUUSD"};
function bs(sym,m){if(m.map&&m.map[sym])return m.map[sym];let s=MAPD[sym];if(!s)s=/^[A-Z]{6}=X$/.test(sym)?sym.slice(0,6):/USDT(\.P)?$/.test(sym)?sym.replace(".P","").replace(/USDT$/,"USD"):sym.replace(/^\^/,"");return s+(m.suffix||"")}
const mtBase=m=>`https://mt-client-api-v1.${m.region||"new-york"}.agiliumtrade.ai/users/current/accounts/${m.acc}`;
async function mtj(m,url,opt){const r=await fetch(url,{...(opt||{}),headers:{"auth-token":m.tok,"Content-Type":"application/json"}}),t=await r.text();let j;try{j=JSON.parse(t)}catch{j=t}if(!r.ok)throw(j&&j.message)||("MetaApi HTTP "+r.status);return j}
async function mtCandles(m,sym,tf){const u=`https://mt-market-data-client-api-v1.${m.region||"new-york"}.agiliumtrade.ai/users/current/accounts/${m.acc}/historical-market-data/symbols/${encodeURIComponent(bs(sym,m))}/timeframes/${tf}/candles?startTime=${encodeURIComponent(new Date().toISOString())}&limit=300`;
 const j=await mtj(m,u),d=j.map(x=>({t:Date.parse(x.time),o:x.open,h:x.high,l:x.low,c:x.close,v:x.tickVolume||0})).sort((a,b)=>a.t-b.t);if(d.length<200)throw"too few candles";return d}
async function candles(sym,tf,c){if(c&&c.mt&&c.mt.data&&c.mt.tok&&c.mt.acc){try{return await mtCandles(c.mt,sym,tf)}catch{}}return candlesDef(sym,tf)}
const today=()=>new Date().toISOString().slice(0,10);
async function placeTrade(c,s,st,auto){
 const m=c.mt;if(!m||!m.tok||!m.acc)throw"MT5 is not set up";
 for(const k of["entry","sl","tp1","tp2"])if(!isFinite(s[k]))throw"Bad setup values";
 const sym=bs(s.sym,m),dir=s.dir>0?1:-1,R=Math.abs(s.entry-s.sl);if(!(R>0))throw"Bad stop distance";
 const b=mtBase(m),e=encodeURIComponent(sym);
 const[ai,pos,sp,px]=await Promise.all([mtj(m,b+"/account-information"),mtj(m,b+"/positions"),mtj(m,`${b}/symbols/${e}/specification`),mtj(m,`${b}/symbols/${e}/current-price`)]);
 const eq0=ai.equity||ai.balance;if(!st.day||st.day.d!==today())st.day={d:today(),n:0,eq:eq0};if(!st.day.eq)st.day.eq=eq0;
 if(auto&&(m.maxDD||3)>0&&(st.day.eq-eq0)/st.day.eq*100>=(m.maxDD||3))throw`daily loss limit of ${m.maxDD||3}% reached, auto-trading is paused until tomorrow`;
 if(auto&&st.day.n>=(m.maxDay||3))throw`daily limit of ${m.maxDay||3} auto-trades reached`;
 if(pos.length>=(m.maxOpen||3))throw`already ${pos.length} open trades (limit ${m.maxOpen||3})`;
 if(pos.some(p=>p.symbol===sym))throw`you already have an open trade on ${sym}`;
 if(/^[A-Z]{6}/.test(sym)){const ex={},add=(s,d)=>{const b=s.slice(0,3),q=s.slice(3,6);ex[b]=(ex[b]||0)+d;ex[q]=(ex[q]||0)-d};for(const p of pos)if(/^[A-Z]{6}/.test(p.symbol))add(p.symbol,p.type==="POSITION_TYPE_BUY"?1:-1);add(sym,dir);
  for(const k in ex)if(Math.abs(ex[k])>(m.maxCur||2))throw`too much exposure to ${k} (limit ${m.maxCur||2} trades per currency in the same direction)`}
 const ref=dir>0?px.ask:px.bid;if(!ref)throw"no live price for "+sym;
 if(Math.abs(ref-s.entry)/s.entry>.03)throw`price mismatch (${fx(ref)} on MT5 vs ${fx(s.entry)} in the setup): check the symbol mapping`;
 if(dir>0?ref>s.entry+.5*R:ref<s.entry-.5*R)throw"price already ran past the entry zone, skipping so you don't chase";
 const risk=Math.min(Math.max(+m.risk||.5,.05),2),eq=ai.equity||ai.balance,riskUsd=eq*risk/100;
 let loss=R*(sp.contractSize||100000);if(/JPY$/.test(sym.replace(m.suffix||"","")))loss/=ref;
 const step=sp.volumeStep||.01,min=sp.minVolume||.01,max=sp.maxVolume||100,dec=(String(step).split(".")[1]||"").length;
 let lots=Math.floor(riskUsd/loss/step)*step;
 if(lots<min){if(min*loss>riskUsd*2)throw`smallest lot (${min}) would risk about ${(min*loss/eq*100).toFixed(1)}% of your account, above your ${risk}% limit`;lots=min}
 lots=+Math.min(lots,max).toFixed(dec);
 const dg=sp.digits==null?5:sp.digits,P=x=>+x.toFixed(dg),slp=P(ref-dir*R),t1=P(ref+dir*1.5*R),t2=P(ref+dir*3*R);
 const parts=lots>=2*min?[[+(Math.floor(lots/2/step)*step).toFixed(dec),t1],[+(lots-Math.floor(lots/2/step)*step).toFixed(dec),t2]]:[[lots,t2]];
 const res=[];for(const[v,tp]of parts){const r=await mtj(m,b+"/trade",{method:"POST",body:JSON.stringify({actionType:dir>0?"ORDER_TYPE_BUY":"ORDER_TYPE_SELL",symbol:sym,volume:v,stopLoss:slp,takeProfit:tp,comment:"SharpScan"})});
  if(r.numericCode!==10009&&r.numericCode!==10008)throw`broker refused: ${r.stringCode||r.message||"unknown"}`;res.push({v,tp})}
 st.day.n++;return{sym,dir,lots,parts:res,ref,sl:slp,riskUsd:+riskUsd.toFixed(2),risk}}
const tradeMsg=(r,a)=>`🤖 ${a?"AUTO-TRADE":"TRADE"} placed on MT5
${r.dir>0?"BUY":"SELL"} ${r.sym} · ${r.lots} lots${r.parts.length>1?" (split in two)":""}
Entry ~${fx(r.ref)}
Stop loss ${fx(r.sl)}
${r.parts.map((p,i)=>`TP${r.parts.length>1?i+1:2} ${fx(p.tp)} (${p.v} lots)`).join("\n")}
Risk about $${r.riskUsd} (${r.risk}% of equity)
⚠️ Move the stop to entry at TP1 yourself.`;
const getCfg=async env=>JSON.parse(await env.KV.get("cfg")||"null");
const getSt=async env=>JSON.parse(await env.KV.get("state")||'{"setups":{},"alerts":{}}');
const cleanF=f=>f?{conf:+f.conf||60,agree:+f.agree||4,htf:!!f.htf,adx:+f.adx||0,vp:+f.vp||0,h1:f.h1==null?null:+f.h1,h2:f.h2==null?null:+f.h2}:null;
const paused=(st,key)=>{const h=(st.hist||[]).filter(x=>x.sym+"|"+x.tf===key).slice(-8);return h.length>=8&&h.reduce((a,x)=>a+x.R,0)<-3?"paused after poor live results":null};
async function newsEvents(env){try{let n=JSON.parse(await env.KV.get("news")||"null");if(!n||Date.now()-n.t>6*36e5){const j=await gj("https://nfs.faireconomy.media/ff_calendar_thisweek.json");n={t:Date.now(),items:j.filter(x=>x.impact==="High").map(x=>({c:x.country,t:Date.parse(x.date)}))};await env.KV.put("news",JSON.stringify(n))}return n.items}catch{return[]}}
const curOf=s=>/^[A-Z]{6}=X$/.test(s)?[s.slice(0,3),s.slice(3,6)]:s==="^GDAXI"?["EUR"]:s==="^FTSE"?["GBP"]:s==="^N225"?["JPY"]:["USD"];
const newsHit=(s,items,now)=>{const c=curOf(s);return items.some(e=>c.includes(e.c)&&Math.abs(e.t-now)<30*6e4)?"high-impact news within 30 minutes":null};
async function scan(env){
 const c=await getCfg(env);if(!c||!c.watch||!c.watch.length||!c.tfs||!c.tfs.length)return;
 const pairs=c.watch.flatMap(s=>c.tfs.map(t=>[s,t])),per=12,slot=Math.floor(Date.now()/60000),n=Math.min(per,pairs.length),start=(slot*per)%pairs.length,now=Date.now();
 const st=await getSt(env);st.track=st.track||{};st.hist=st.hist||[];let dirty=false;const nw=c.news?await newsEvents(env):null;
 const gated=c.gate&&Object.keys(c.gate).length>0,cm=new Map(),gc=(s,t)=>{const k=s+t;if(!cm.has(k))cm.set(k,candles(s,t,c));return cm.get(k)};
 for(let i=0;i<n;i++){const[sym,tf]=pairs[(start+i)%pairs.length],key=sym+"|"+tf;
  try{let r=await gc(sym,tf);if(r.length&&r.at(-1).t+TFM[tf]*60000>now)r=r.slice(0,-1);
   for(const k in st.track){const t=st.track[k];if(t.sym!==sym||t.tf!==tf)continue;const j=r.findIndex(x=>x.t>t.ct);if(j<0)continue;const x=sim(r,j,t.dir,t.R,BO);
    if(x){st.hist.push({sym,tf,dir:t.dir,R:+x.R.toFixed(2),out:x.out,conf:t.conf,ts:now});delete st.track[k];dirty=true}else if(now-t.ts>7*864e5){delete st.track[k];dirty=true}}
   let ht=0;if(HT[tf]){try{ht=stack(await gc(sym,HT[tf]))}catch{}}
   const a=analyse(r,ht),ok=a&&a.T&&a.conf>=(c.minConf||60);let s=null,why=null,bt=null;
   if(ok){s=mk(sym,tf,a);bt=gated?c.gate[key]:null;why=(gated&&!bt)?"not approved by backtest":filt(s,c.f,tf)||paused(st,key)||(nw?newsHit(sym,nw,now):null)}
   if(ok&&!why){const o=st.setups[key];
    if(!o||o.dir!==s.dir||Math.abs(o.conf-s.conf)>=5){st.setups[key]=o&&o.dir===s.dir?{...s,ts:o.ts}:s;dirty=true}
    const ak=key+s.dir;if(now-(st.alerts[ak]||0)>(c.cool||60)*60000){st.alerts[ak]=now;dirty=true;
     st.track[key+"|"+s.ct]={sym,tf,dir:s.dir,R:Math.abs(s.entry-s.sl),ct:s.ct,conf:s.conf,ts:now};
     await tgSend(c,msgText(s,c.appUrl,bt));
     if(c.mt&&c.mt.auto&&c.mt.ack&&s.conf>=(c.mt.minConf||75)){try{const r2=await placeTrade(c,s,st,true);await tgSend(c,tradeMsg(r2,true))}catch(e){await tgSend(c,"⚠️ MT5 auto-trade skipped for "+lab(s.sym)+": "+e)}}}}
   else if(st.setups[key]){delete st.setups[key];dirty=true}
  }catch(e){}}
 for(const k in st.setups){const s=st.setups[k];if(now-s.ts>Math.max(3*TFM[s.tf],60)*60000){delete st.setups[k];dirty=true}}
 for(const k in st.alerts)if(now-st.alerts[k]>2*864e5){delete st.alerts[k];dirty=true}
 const tk=Object.keys(st.track);if(tk.length>60){tk.sort((a,b)=>st.track[a].ts-st.track[b].ts).slice(0,tk.length-60).forEach(k=>delete st.track[k]);dirty=true}
 if(st.hist.length>100){st.hist=st.hist.slice(-100);dirty=true}
 if(dirty)await env.KV.put("state",JSON.stringify(st));
 if(slot%10===0)await env.KV.put("run",String(now))}
export default{
 async fetch(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{headers:CORS});
  if(!env.KEY||req.headers.get("x-key")!==env.KEY)return J({error:"Wrong password"},401);
  if(!env.KV)return J({error:"KV storage is not bound to the worker"},500);
  try{
   if(u.pathname==="/candles"){const dp=u.searchParams.get("deep")==="1";return J(dp?await candlesDef(u.searchParams.get("s"),u.searchParams.get("tf"),true):await candles(u.searchParams.get("s"),u.searchParams.get("tf"),await getCfg(env)))}
   if(u.pathname==="/ping"){const c=await getCfg(env);return J({ok:true,watch:c?c.watch.length:0,tfs:c?c.tfs:[],run:+(await env.KV.get("run")||0),telegram:!!(c&&c.tgT&&c.tgC),mt:!!(c&&c.mt&&c.mt.tok),auto:!!(c&&c.mt&&c.mt.auto)})}
   if(u.pathname==="/setups"){const st=await getSt(env),c=await getCfg(env);return J({hist:st.hist||[],setups:Object.values(st.setups).sort((a,b)=>b.conf-a.conf),watch:c?c.watch.length:0,tfs:c?c.tfs:[],run:+(await env.KV.get("run")||0)})}
   if(u.pathname==="/config"&&req.method==="POST"){const b=await req.json();const c={watch:(b.watch||[]).slice(0,300).map(String),tfs:(b.tfs||[]).filter(t=>TFM[t]),minConf:+b.minConf||60,cool:+b.cool||60,tgT:String(b.tgT||""),tgC:String(b.tgC||""),appUrl:String(b.appUrl||""),f:cleanF(b.f),gate:(b.gate&&typeof b.gate==="object")?b.gate:null,news:!!b.news};const M=b.mt;if(M&&M.tok&&M.acc)c.mt={tok:String(M.tok),acc:String(M.acc),region:String(M.region||"new-york"),suffix:String(M.suffix||""),map:(M.map&&typeof M.map==="object")?M.map:{},data:!!M.data,ack:M.ack===true,auto:M.auto===true&&M.ack===true,risk:Math.min(+M.risk||.5,2),maxOpen:Math.min(+M.maxOpen||3,10),maxDay:Math.min(+M.maxDay||3,20),minConf:Math.max(+M.minConf||75,50),maxDD:Math.min(+M.maxDD||3,20)};await env.KV.put("cfg",JSON.stringify(c));return J({ok:true,pairs:c.watch.length*c.tfs.length})}
   if(u.pathname==="/test"){const c=await getCfg(env);return J({ok:await tgSend(c||{},"✅ SharpScan background scanner is connected. Setups will arrive here.")})}
   if(u.pathname==="/mt/test"){const c=await getCfg(env);if(!c||!c.mt)return J({ok:false,error:"Save and sync first"});const m=c.mt,o={ok:true};try{const a=await mtj(m,mtBase(m)+"/account-information");o.balance=a.balance;o.equity=a.equity;o.currency=a.currency;o.server=a.server;o.name=a.name;o.tradeAllowed=a.tradeAllowed}catch(e){return J({ok:false,error:String(e)})}
    try{o.positions=(await mtj(m,mtBase(m)+"/positions")).length}catch{}try{await mtCandles(m,"EURUSD=X","15m");o.candles=true}catch(e){o.candles=false;o.candleError=String(e)}return J(o)}
   if(u.pathname==="/mt/trade"&&req.method==="POST"){const c=await getCfg(env),b=await req.json();if(!c||!c.mt)return J({ok:false,error:"Save and sync first"});if(b.confirm!==true)return J({ok:false,error:"Not confirmed"});const st=await getSt(env);
    try{const r=await placeTrade(c,{sym:String(b.s.sym),dir:+b.s.dir,entry:+b.s.entry,sl:+b.s.sl,tp1:+b.s.tp1,tp2:+b.s.tp2},st,false);await env.KV.put("state",JSON.stringify(st));await tgSend(c,tradeMsg(r,false));return J({ok:true,r})}catch(e){return J({ok:false,error:String(e)})}}
   if(u.pathname==="/scan-now"){await scan(env);return J({ok:true})}
   return J({error:"Not found"},404)}catch(e){return J({error:String(e)},500)}},
 async scheduled(ev,env,ctx){ctx.waitUntil(scan(env))}}
