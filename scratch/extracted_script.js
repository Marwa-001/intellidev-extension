
const vscode = acquireVsCodeApi();
const rbtn = document.getElementById('rbtn');
rbtn.addEventListener('click', () => { rbtn.classList.add('spin'); vscode.postMessage({command:'refresh'}); setTimeout(()=>rbtn.classList.remove('spin'),800); });

// Signal the extension that the webview JS is ready to receive messages
vscode.postMessage({ command: 'ready' });

let periodMode = 'weekly';
let dangerOpen  = false;

function scoreColor(s){ return s<30?'#1ABC9C':s<60?'#F39C12':s<80?'#FF8C42':'#FF4B7D'; }

function mkCtx(id, h){
  const el=document.getElementById(id); if(!el) return null;
  const dpr=window.devicePixelRatio||1, w=el.offsetWidth||230;
  el.width=w*dpr; el.height=h*dpr; el.style.height=h+'px';
  const ctx=el.getContext('2d'); ctx.scale(dpr,dpr);
  ctx._w=w; ctx._h=h; return ctx;
}

// ── Info popover toggle ───────────────────────────────────────────────────────
function toggleInfo(id) {
  const pop = document.getElementById('info-' + id);
  if (!pop) { return; }
  // Close all others first
  document.querySelectorAll('.info-pop.show').forEach(el => {
    if (el.id !== 'info-' + id) { el.classList.remove('show'); }
  });
  pop.classList.toggle('show');
}

// ── Chart info definitions ────────────────────────────────────────────────────
// Each entry: { id, title, body, thresholds? }
const CHART_INFO = {
  trend: {
    title: 'Score Trend',
    body: 'Each dot is one session. The score (0–100) measures cognitive strain based on your typing rhythm, error count, file switching, and session length. Lower is better.',
    thresholds: [
      { color:'#1ABC9C', label:'0–29', desc:"Stable Focus — you're in flow" },
      { color:'#F39C12', label:'30–59', desc:'Mild Strain — consider a break' },
      { color:'#FF8C42', label:'60–79', desc:'High Load — take 10–15 min off' },
      { color:'#FF4B7D', label:'80+',   desc:'Burnout Risk — rest now' },
    ]
  },
  break: {
    title: 'Score Breakdown',
    body: 'Each session bar is split into four stacked categories. Taller bars = more strain from that category. Use this to spot patterns — e.g. if Error is always tall, you may need to slow down and test more often.',
    thresholds: [
      { color:'#00B4D8', label:'Typing',  desc:'Rhythm, variability, backspaces, pauses' },
      { color:'#FF4B7D', label:'Errors',  desc:'Compile errors, debug sessions, bursts' },
      { color:'#F39C12', label:'Context', desc:'File switches per 10 min window' },
      { color:'#FF8C42', label:'Session', desc:'Duration, idle ratio, night coding' },
    ]
  },
  err: {
    title: 'Error Density',
    body: 'Shows compilation/linter errors per 10-minute window across your session history. The yellow dashed line marks the threshold (5 errors/window) where the scoring engine starts adding load points.',
    thresholds: [
      { color:'#FF4B7D', label:'Avg rate', desc:'Mean errors per 10-min window' },
      { color:'#FF8C42', label:'Peak rate', desc:'Highest error count seen in any window' },
      { color:'#F39C12', label:'Threshold line (5)', desc:'Above this = high_error_rate rule fires (+15 pts)' },
    ]
  },
  ctx: {
    title: 'Context Switching',
    body: 'The bars show how many times you switched files per 10-minute window (switch frequency). The pink line tracks rapid switches — file changes that happened within 5 seconds of each other.',
    thresholds: [
      { color:'#00B4D8', label:'Switch frequency', desc:'File changes per 10 min. Threshold: >8 adds load' },
      { color:'#FF4B7D', label:'Rapid switches',   desc:'Switches under 5s apart. Threshold: >5 adds load' },
      { color:'rgba(0,180,216,.4)', label:'Reading mode', desc:'Low typing + moderate switches = score dampened' },
    ]
  },
  dw: {
    title: 'Deep Work vs Idle',
    body: "Deep work = the longest continuous block of typing without going idle (2+ min with no activity). Idle time = total minutes where no keystrokes were detected. High idle is fine if you're reading or thinking.",
    thresholds: [
      { color:'#1ABC9C', label:'Deep work', desc:'Longest uninterrupted coding block (minutes)' },
      { color:'#FF8C42', label:'Idle time', desc:'Total idle minutes in the session' },
    ]
  },
  heat: {
    title: 'Cognitive Load Heatmap',
    body: "Each cell = one session. Rows = hour of day, columns = date. Color shows that session's cognitive load score. Dark = low load; red = high load. Useful for spotting your peak performance hours.",
    thresholds: [
      { color:'#1ABC9C', label:'Green (<30)',  desc:'Stable, low cognitive load' },
      { color:'#F39C12', label:'Yellow (<60)', desc:'Mild strain' },
      { color:'#FF8C42', label:'Orange (<80)', desc:'High load' },
      { color:'#FF4B7D', label:'Red (80+)',    desc:'Burnout risk' },
    ]
  },
};

function infoPopHtml(id) {
  const cfg = CHART_INFO[id]; if (!cfg) { return ''; }
  let thtml = '';
  if (cfg.thresholds) {
    thtml = '<div class="thresholds">' + cfg.thresholds.map(t =>
      `<div class="trow"><span class="tdot" style="background:${t.color}"></span><strong>${t.label}</strong><span class="tval">— ${t.desc}</span></div>`
    ).join('') + '</div>';
  }
  return `<div class="info-pop" id="info-${id}">
    <strong>${cfg.title}</strong> — ${cfg.body}${thtml}
  </div>`;
}

function secHtml(label, infoId) {
  const btn = infoId
    ? `<button class="info-btn" data-action="toggleInfo" data-id="${infoId}" title="What does this chart mean?">ℹ</button>`
    : '';
  return `<div class="sec">${label}${btn}</div>`;
}

function drawGauge(canvasId, score, label){
  const el=document.getElementById(canvasId); if(!el) return;
  const dpr=window.devicePixelRatio||1, size=160;
  el.width=size*dpr; el.height=(size/2+30)*dpr;
  el.style.width=size+'px'; el.style.height=(size/2+30)+'px';
  const ctx=el.getContext('2d'); ctx.scale(dpr,dpr);
  const cx=size/2, cy=size/2+4, r=size/2-8;
  ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,2*Math.PI);
  ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=16; ctx.lineCap='round'; ctx.stroke();
  [[0,30,'#1ABC9C'],[30,60,'#F39C12'],[60,80,'#FF8C42'],[80,100,'#FF4B7D']].forEach(([f,t,c])=>{
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI+(f/100)*Math.PI,Math.PI+(t/100)*Math.PI);
    ctx.strokeStyle=c; ctx.lineWidth=16; ctx.lineCap='butt'; ctx.stroke();
  });
  const sa=Math.PI+(score/100)*Math.PI;
  ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,sa);
  const g=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  g.addColorStop(0,'#1ABC9C');g.addColorStop(.5,'#F39C12');g.addColorStop(.8,'#FF8C42');g.addColorStop(1,'#FF4B7D');
  ctx.strokeStyle=g; ctx.lineWidth=16; ctx.lineCap='round'; ctx.stroke();
  const nx=cx+Math.cos(sa)*(r-16), ny=cy+Math.sin(sa)*(r-16);
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(nx,ny);
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
  ctx.fillStyle=scoreColor(score); ctx.font='bold 28px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(score, cx, cy+10);
  ctx.fillStyle='#C9D1D9'; ctx.font='bold 9px sans-serif'; ctx.fillText(label, cx, cy-r-6);
  // Zone labels on gauge arc
  ctx.font='7px sans-serif'; ctx.textBaseline='alphabetic';
  ctx.fillStyle='#1ABC9C'; ctx.textAlign='center'; ctx.fillText('Stable',cx-r+2,cy+22);
  ctx.fillStyle='#F39C12'; ctx.fillText('Mild',cx,cy+22);
  ctx.fillStyle='#FF4B7D'; ctx.textAlign='center'; ctx.fillText('Risk',cx+r-4,cy+22);
  ctx.fillStyle='#8B949E'; ctx.font='9px monospace'; ctx.textBaseline='alphabetic';
  ctx.textAlign='left'; ctx.fillText('0',cx-r-2,cy+14);
  ctx.textAlign='right'; ctx.fillText('100',cx+r+2,cy+14);
}

function drawTrend(features){
  const ctx=mkCtx('c_trend',80); if(!ctx||features.length<2) return;
  const {_w:w,_h:h}=ctx, pad={l:6,r:6,t:10,b:10};
  const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
  const scores=features.map(f=>f.baseline_score!=null?f.baseline_score:(f.cognitive_score||0));
  const step=cw/(scores.length-1);
  const px=i=>pad.l+i*step, py=v=>pad.t+ch-(v/100)*ch;

  // Threshold bands with labels
  const thresholds = [{v:80,c:'rgba(255,75,125,.55)',lbl:'Burnout 80'},{v:60,c:'rgba(255,140,66,.5)',lbl:'High 60'},{v:30,c:'rgba(243,156,18,.35)',lbl:'Mild 30'}];
  thresholds.forEach(({v,c,lbl})=>{
    const y=py(v); ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y);
    ctx.strokeStyle=c; ctx.lineWidth=1.2; ctx.stroke(); ctx.setLineDash([]);
    ctx.font='7px sans-serif'; ctx.textAlign='right'; ctx.fillStyle=c.replace(/,[^)]+\)/,',0.9)');
    ctx.fillText(lbl, pad.l+cw-1, y-2);
  });

  ctx.setLineDash([3,4]);
  ctx.beginPath(); scores.forEach((v,i)=>{ i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)); });
  ctx.strokeStyle='#00B4D8'; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.stroke(); ctx.setLineDash([]);
  scores.forEach((v,i)=>{
    ctx.beginPath(); ctx.arc(px(i),py(v),4,0,Math.PI*2);
    ctx.fillStyle=scoreColor(v); ctx.fill();
    ctx.beginPath(); ctx.arc(px(i),py(v),4,0,Math.PI*2);
    ctx.strokeStyle='#0D1117'; ctx.lineWidth=1; ctx.stroke();
  });
}

function drawBreakdown(features){
  const ctx=mkCtx('c_break',90); if(!ctx||!features.length) return;
  const {_w:w,_h:h}=ctx, pad={l:28,r:6,t:8,b:18};
  const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
  const n=features.length, bw=Math.max(5,Math.min(20,cw/n-4)), gap=(cw-n*bw)/(n+1);
  const cats=[['typing_score','#00B4D8'],['error_score','#FF4B7D'],['context_score','#F39C12'],['session_score','#FF8C42']];
  features.forEach((f,i)=>{
    let base=pad.t+ch;
    cats.forEach(([k,col])=>{ const v=f[k]||0, bh=(v/100)*ch; ctx.fillStyle=col; ctx.fillRect(pad.l+gap+i*(bw+gap),base-bh,bw,bh); base-=bh; });
  });
  ctx.font='8px monospace'; ctx.textAlign='right'; ctx.fillStyle='rgba(255,255,255,.3)';
  [0,50,100,150].forEach(v=>{ const y=pad.t+ch-(v/180)*ch; if(y<pad.t) return;
    ctx.fillText(v,pad.l-3,y+3); ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y);
    ctx.strokeStyle='rgba(255,255,255,.05)'; ctx.lineWidth=1; ctx.stroke(); });
  // Y-axis label
  ctx.save(); ctx.translate(7,pad.t+ch/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign='center'; ctx.fillStyle='#8B949E'; ctx.font='7px sans-serif';
  ctx.fillText('pts',0,0); ctx.restore();
  ctx.textAlign='center'; ctx.fillStyle='#8B949E';
  features.forEach((f,i)=>{ if(i%2!==0) return; ctx.fillText((f.datetime||'').slice(5,10),pad.l+gap+i*(bw+gap)+bw/2,h-4); });
}

function drawErrors(features){
  const ctx=mkCtx('c_err',80); if(!ctx||features.length<2) return;
  const {_w:w,_h:h}=ctx, pad={l:6,r:6,t:10,b:10};
  const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
  const avg=features.map(f=>f.avg_error_rate||0), peak=features.map(f=>f.max_error_rate||0);
  const maxV=Math.max(...avg,...peak,15), step=cw/(features.length-1);
  const px=i=>pad.l+i*step, py=v=>pad.t+ch-(v/maxV)*ch;

  // Threshold line at 5 errors/window with label
  const ty=py(5); ctx.setLineDash([5,3]);
  ctx.beginPath(); ctx.moveTo(pad.l,ty); ctx.lineTo(pad.l+cw,ty);
  ctx.strokeStyle='rgba(243,156,18,.75)'; ctx.lineWidth=1.2; ctx.stroke(); ctx.setLineDash([]);
  ctx.font='7px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='rgba(243,156,18,.9)';
  ctx.fillText('threshold (5/window)', pad.l+2, ty-2);

  // Second threshold at 12
  if(maxV>10){
    const ty2=py(12); ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(pad.l,ty2); ctx.lineTo(pad.l+cw,ty2);
    ctx.strokeStyle='rgba(255,75,125,.5)'; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font='7px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='rgba(255,75,125,.8)';
    ctx.fillText('critical (12)', pad.l+2, ty2-2);
  }

  const gp=ctx.createLinearGradient(0,pad.t,0,h); gp.addColorStop(0,'rgba(255,140,66,.2)'); gp.addColorStop(1,'rgba(255,140,66,0)');
  ctx.beginPath(); peak.forEach((v,i)=>{ i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)); });
  ctx.lineTo(px(features.length-1),h); ctx.lineTo(px(0),h); ctx.closePath(); ctx.fillStyle=gp; ctx.fill();
  const ga=ctx.createLinearGradient(0,pad.t,0,h); ga.addColorStop(0,'rgba(255,75,125,.4)'); ga.addColorStop(1,'rgba(255,75,125,0)');
  ctx.beginPath(); avg.forEach((v,i)=>{ i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)); });
  ctx.lineTo(px(features.length-1),h); ctx.lineTo(px(0),h); ctx.closePath(); ctx.fillStyle=ga; ctx.fill();
  ctx.setLineDash([5,4]);
  ctx.beginPath(); peak.forEach((v,i)=>{ i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)); });
  ctx.strokeStyle='#FF8C42'; ctx.lineWidth=1.5; ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); avg.forEach((v,i)=>{ i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)); });
  ctx.strokeStyle='#FF4B7D'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  avg.forEach((v,i)=>{ ctx.beginPath(); ctx.arc(px(i),py(v),3,0,Math.PI*2); ctx.fillStyle='#FF4B7D'; ctx.fill(); });

  // Y-axis label
  ctx.font='7px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#8B949E';
  ctx.fillText('errors/10 min', pad.l, h-1);
}

function drawContext(features){
  const ctx=mkCtx('c_ctx',88); if(!ctx||!features.length) return;
  const {_w:w,_h:h}=ctx, pad={l:6,r:6,t:8,b:18};
  const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
  const n=features.length, bw=Math.max(5,Math.min(18,cw/n-4)), gap=(cw-n*bw)/(n+1);
  const freqs=features.map(f=>f.avg_switch_frequency||0), rapids=features.map(f=>f.rapid_switch_count||0);
  const maxF=Math.max(...freqs,1), maxR=Math.max(...rapids,1);

  // Threshold lines for switch frequency
  const thresh8 = pad.t+ch-(8/Math.max(maxF,16))*ch;
  const thresh15 = pad.t+ch-(15/Math.max(maxF,16))*ch;
  if(thresh8 > pad.t){
    ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(pad.l,thresh8); ctx.lineTo(pad.l+cw,thresh8);
    ctx.strokeStyle='rgba(243,156,18,.5)'; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font='7px sans-serif'; ctx.textAlign='right'; ctx.fillStyle='rgba(243,156,18,.75)';
    ctx.fillText('>8 mild', pad.l+cw-1, thresh8-2);
  }
  if(thresh15 > pad.t){
    ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(pad.l,thresh15); ctx.lineTo(pad.l+cw,thresh15);
    ctx.strokeStyle='rgba(255,140,66,.5)'; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font='7px sans-serif'; ctx.textAlign='right'; ctx.fillStyle='rgba(255,140,66,.8)';
    ctx.fillText('>15 high', pad.l+cw-1, thresh15-2);
  }

  features.forEach((_,i)=>{ const bh=(freqs[i]/maxF)*ch; ctx.fillStyle='rgba(0,180,216,.75)'; ctx.fillRect(pad.l+gap+i*(bw+gap),pad.t+ch-bh,bw,bh); });
  ctx.beginPath(); rapids.forEach((v,i)=>{ const x=pad.l+gap+i*(bw+gap)+bw/2, y=pad.t+ch-(v/maxR)*ch; i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.strokeStyle='#FF4B7D'; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
  rapids.forEach((v,i)=>{ const x=pad.l+gap+i*(bw+gap)+bw/2, y=pad.t+ch-(v/maxR)*ch;
    ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fillStyle='#FF4B7D'; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.strokeStyle='#0D1117'; ctx.lineWidth=1.5; ctx.stroke(); });

  ctx.font='8px monospace'; ctx.textAlign='center'; ctx.fillStyle='#8B949E';
  features.forEach((f,i)=>{ if(i%2!==0) return; ctx.fillText((f.datetime||'').slice(5,10),pad.l+gap+i*(bw+gap)+bw/2,h-4); });

  // Y-axis units
  ctx.font='7px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#8B949E';
  ctx.fillText('switches/10 min', pad.l, h-1);
}

function drawDeepWork(features){
  const ctx=mkCtx('c_dw',88); if(!ctx||!features.length) return;
  const {_w:w,_h:h}=ctx, pad={l:6,r:6,t:8,b:18};
  const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
  const n=features.length, pw=Math.max(8,Math.min(26,cw/n-4)), bw=(pw-2)/2, gap=(cw-n*pw)/(n+1);
  const dw=features.map(f=>f.longest_deep_work_minutes||0);
  const idle=features.map(f=>(f.session_duration_minutes||0)*(f.idle_ratio||0));
  const maxV=Math.max(...dw,...idle,1);

  // Deep work goal line at 25 minutes
  const goalY = pad.t+ch-(25/Math.max(maxV,30))*ch;
  if(goalY > pad.t){
    ctx.setLineDash([5,3]); ctx.beginPath(); ctx.moveTo(pad.l,goalY); ctx.lineTo(pad.l+cw,goalY);
    ctx.strokeStyle='rgba(26,188,156,.5)'; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font='7px sans-serif'; ctx.textAlign='right'; ctx.fillStyle='rgba(26,188,156,.8)';
    ctx.fillText('goal 25 min', pad.l+cw-1, goalY-2);
  }

  features.forEach((f,i)=>{ const x=pad.l+gap+i*(pw+gap);
    ctx.fillStyle='#1ABC9C'; ctx.fillRect(x,pad.t+ch-(dw[i]/maxV)*ch,bw,(dw[i]/maxV)*ch);
    ctx.fillStyle='#FF8C42'; ctx.fillRect(x+bw+2,pad.t+ch-(idle[i]/maxV)*ch,bw,(idle[i]/maxV)*ch); });
  ctx.font='8px monospace'; ctx.textAlign='center'; ctx.fillStyle='#8B949E';
  features.forEach((f,i)=>{ if(i%2!==0) return; ctx.fillText((f.datetime||'').slice(5,10),pad.l+gap+i*(pw+gap)+pw/2,h-4); });

  // Y-axis units
  ctx.font='7px sans-serif'; ctx.textAlign='left'; ctx.fillStyle='#8B949E';
  ctx.fillText('minutes', pad.l, h-1);
}

function drawHeatmap(features){
  const ctx=mkCtx('c_heat',110); if(!ctx||!features.length) return;
  const {_w:w,_h:h}=ctx;
  const days=[...new Set(features.map(f=>(f.datetime||'').slice(5,10)))];
  const hours=[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
  if(!days.length) return;
  const pad={l:26,r:4,t:4,b:18}, cw2=(w-pad.l-pad.r)/days.length, rh=(h-pad.t-pad.b)/hours.length;
  const lu={};
  features.forEach(f=>{ const day=(f.datetime||'').slice(5,10), hr=parseInt((f.datetime||'T00').slice(11,13)); lu[day+'_'+hr]=f.cognitive_score||0; });
  function hmc(v){ if(!v) return 'rgba(13,17,23,.8)'; if(v<30) return '#1ABC9C'; if(v<60) return '#F39C12'; if(v<80) return '#FF8C42'; return '#FF4B7D'; }
  hours.forEach((hr,ri)=>{
    days.forEach((day,ci)=>{ ctx.fillStyle=hmc(lu[day+'_'+hr]||0); ctx.fillRect(pad.l+ci*cw2+1,pad.t+ri*rh+1,cw2-2,rh-2); });
    ctx.fillStyle='rgba(255,255,255,.35)'; ctx.font='8px monospace'; ctx.textAlign='right';
    ctx.fillText(hr+':00',pad.l-2,pad.t+ri*rh+rh/2+3);
  });
  ctx.textAlign='center'; ctx.fillStyle='#8B949E'; ctx.font='8px monospace';
  days.forEach((day,ci)=>{ ctx.fillText(day,pad.l+ci*cw2+cw2/2,h-4); });
}

function renderComparison(periodStats, mode){
  const periods = mode==='weekly' ? periodStats.weekly : periodStats.monthly;
  if(!periods||!periods.length) return '<div class="no-data">Not enough data for comparison yet.</div>';
  function delta(curr, prev, lowerIsBetter){
    if(prev===0||prev==null) return '';
    const pct=Math.round((curr-prev)/Math.abs(prev)*100);
    if(Math.abs(pct)<2) return '<span class="delta neu">~</span>';
    const better = lowerIsBetter ? pct<0 : pct>0;
    return `<span class="delta ${better?'down':'up'}">${pct>0?'+':''}${pct}%</span>`;
  }
  const rows = periods.map((p, i) => {
    const prev = periods[i+1];
    return `<div class="comp-period">
      <div class="comp-period-lbl">${p.label} <span style="color:#8B949E;font-size:9px">(${p.sessionCount} sessions)</span></div>
      <div class="comp-metrics">
        <div class="comp-metric"><span class="comp-metric-name">Avg Score</span><span class="comp-metric-val" style="color:${scoreColor(p.avgScore)}">${p.avgScore}${prev?delta(p.avgScore,prev.avgScore,true):''}</span></div>
        <div class="comp-metric"><span class="comp-metric-name">KPM</span><span class="comp-metric-val">${p.avgKpm}${prev?delta(p.avgKpm,prev.avgKpm,false):''}</span></div>
        <div class="comp-metric"><span class="comp-metric-name">Error Rate</span><span class="comp-metric-val">${p.avgErrorRate}${prev?delta(p.avgErrorRate,prev.avgErrorRate,true):''}</span></div>
        <div class="comp-metric"><span class="comp-metric-name">Deep Work</span><span class="comp-metric-val">${p.avgDeepWork}m${prev?delta(p.avgDeepWork,prev.avgDeepWork,false):''}</span></div>
        <div class="comp-metric"><span class="comp-metric-name">Switches/10m</span><span class="comp-metric-val">${p.avgSwitches}${prev?delta(p.avgSwitches,prev.avgSwitches,true):''}</span></div>
        <div class="comp-metric"><span class="comp-metric-name">Hours Coded</span><span class="comp-metric-val">${p.totalHours}h</span></div>
      </div></div>`;
  });
  let html='<div class="comp-grid">';
  for(let i=0;i<rows.length;i+=2){ html+=`<div class="comp-row">${rows[i]}${rows[i+1]||''}</div>`; }
  return html+'</div>';
}

function renderDangerZone(){
  const bodyClass = dangerOpen ? 'danger-body open' : 'danger-body';
  const toggleCls = dangerOpen ? 'danger-toggle open' : 'danger-toggle';
  return `<div class="danger-zone">
    <div class="danger-header" data-action="toggleDanger">
      <span class="danger-header-txt">⚠ Data Management</span>
      <span class="${toggleCls}" id="dtoggle">▼</span>
    </div>
    <div class="${bodyClass}" id="danger-body">
      <div class="danger-desc">All data is stored locally on your machine. These actions cannot be undone.</div>
      <button class="danger-btn baseline-r" data-action="showConfirm" data-id="baseline">↺ Reset Baseline Only</button>
      <div class="confirm-box" id="confirm-baseline">
        <div class="confirm-q">Reset your personal baseline? Session history is kept. Calibration restarts.</div>
        <div class="confirm-btns">
          <button class="cbtn yes" data-action="doDelete" data-cmd="resetBaseline">Yes, Reset</button>
          <button class="cbtn no"  data-action="hideConfirm" data-id="baseline">Cancel</button>
        </div>
      </div>
      <div class="danger-sep"></div>
      <button class="danger-btn sessions" data-action="showConfirm" data-id="sessions">🗑 Delete All Session Data</button>
      <div class="confirm-box" id="confirm-sessions">
        <div class="confirm-q">Delete all session files and reset baseline? This cannot be undone.</div>
        <div class="confirm-btns">
          <button class="cbtn yes" data-action="doDelete" data-cmd="deleteSessionData">Yes, Delete</button>
          <button class="cbtn no"  data-action="hideConfirm" data-id="sessions">Cancel</button>
        </div>
      </div>
      <div class="danger-sep"></div>
      <button class="danger-btn wipe" data-action="showConfirm" data-id="wipe">💥 Full Wipe (New Identity)</button>
      <div class="confirm-box" id="confirm-wipe">
        <div class="confirm-q">Delete everything and generate a new UUID? You will start completely fresh.</div>
        <div class="confirm-btns">
          <button class="cbtn yes" data-action="doDelete" data-cmd="fullWipe">Yes, Wipe Everything</button>
          <button class="cbtn no"  data-action="hideConfirm" data-id="wipe">Cancel</button>
        </div>
      </div>
    </div>
  </div>`;
}

document.body.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action]');
  if (!el) {
    // Click outside any info popover closes all
    if (!e.target.closest('.info-pop') && !e.target.closest('.info-btn')) {
      document.querySelectorAll('.info-pop.show').forEach(p => p.classList.remove('show'));
    }
    return;
  }
  const action = el.getAttribute('data-action');
  if (action === 'toggleDanger') {
    dangerOpen = !dangerOpen;
    const body = document.getElementById('danger-body');
    const tog  = document.getElementById('dtoggle');
    if (body) { body.classList.toggle('open', dangerOpen); }
    if (tog)  { tog.classList.toggle('open',  dangerOpen); }
  } else if (action === 'toggleInfo') {
    toggleInfo(el.getAttribute('data-id'));
  } else if (action === 'showConfirm') {
    const box = document.getElementById('confirm-' + el.getAttribute('data-id'));
    if (box) { box.classList.add('show'); }
  } else if (action === 'hideConfirm') {
    const box = document.getElementById('confirm-' + el.getAttribute('data-id'));
    if (box) { box.classList.remove('show'); }
  } else if (action === 'doDelete') {
    vscode.postMessage({ command: el.getAttribute('data-cmd') });
  } else if (action === 'setPeriod') {
    periodMode = el.getAttribute('data-mode');
    vscode.postMessage({ command: 'refresh' });
  }
});

window.addEventListener('message', ev => {
  const msg=ev.data; 
  if(msg.command === 'error') {
    document.getElementById('ts').textContent = 'Error updating';
    document.getElementById('content').innerHTML = '<div style="color:red;padding:12px;font-family:monospace;white-space:pre-wrap;">Error: ' + msg.message + '</div>';
    rbtn.classList.remove('spin');
    return;
  }
  if(msg.command!=='update') return;
  document.getElementById('ts').textContent='Updated: '+msg.lastUpdated+' · auto 30s';
  rbtn.classList.remove('spin');

  const features=msg.features||[], alerts=msg.alerts||[], bi=msg.baselineInfo||{}, ps=msg.periodStats||{};
  if(!features.length){
    document.getElementById('content').innerHTML='<div class="empty"><div class="ico">🧠</div><p>No session data yet.<br>Start coding — data appears automatically.</p></div>';
    return;
  }

  const lat=features[features.length-1];
  const isCalibrating=!bi.isCalibrated;
  const displayScore = (!isCalibrating && lat.baseline_score!=null) ? lat.baseline_score : (lat.cognitive_score||0);
  const displayLabel = (!isCalibrating && lat.baseline_label) ? lat.baseline_label : (lat.score_label||'Unknown');

  const avgRaw=(features.reduce((a,f)=>a+(f.cognitive_score||0),0)/features.length).toFixed(1);
  const avgBaseline=bi.isCalibrated
    ? (features.filter(f=>f.baseline_score!=null).reduce((a,f)=>a+(f.baseline_score||0),0)/Math.max(1,features.filter(f=>f.baseline_score!=null).length)).toFixed(1)
    : null;
  const highLoad=features.filter(f=>(f.cognitive_score||0)>=60).length;
  const totalHours=(features.reduce((a,f)=>a+(f.session_duration_minutes||0),0)/60).toFixed(1);
  const kpm=Math.round(lat.avg_kpm||0);
  const xL=(features[0].datetime||'').slice(5,10), xR=(lat.datetime||'').slice(5,10);

  let devChipHtml='';
  if(!isCalibrating && lat.deviation_summary){
    const sigma=parseFloat(lat.deviation_summary);
    const cls=sigma<1?'low':sigma<2?'mid':'high';
    devChipHtml=`<div class="dev-chip ${cls}">📊 ${lat.deviation_summary}</div>`;
  }

  // Reading mode chip — shown when the last session was detected as reading/debugging
  // This tells the user why the score may be lower than expected during a read-heavy session
  const readingChipHtml = lat.reading_mode
    ? `<div class="reading-chip">👁 Reading mode detected — context switching score dampened</div>`
    : '';

  let alertHtml='<div class="noalerts">✅ No alerts in this period.</div>';
  if(alerts.length){
    alertHtml='<div class="alist">'+alerts.slice().reverse().slice(0,6).map(a=>{
      const tl=(a.alert_type||'').replace(/_/g,' '), ts=(a.timestamp||'').slice(11,16);
      const m=(a.message||'').slice(0,90)+((a.message||'').length>90?'…':'');
      return `<div class="aitem ${a.alert_type||''}"><strong>${a.level_emoji||'🔔'} ${tl}</strong><div class="ameta">${ts} · Score ${Math.round(a.score||0)}/100</div><div style="margin-top:2px">${m}</div></div>`;
    }).join('')+'</div>';
  }

  const calibBanner = isCalibrating ? `
    <div class="calib-banner">
      <div class="calib-title">🔬 Building Your Personal Baseline</div>
      <div class="calib-sub">IntelliDev is learning your unique coding patterns.
        Scores shown are rule-based estimates until calibration completes.<br><br>
        Sessions: <strong>${bi.calibrationSessions}/${bi.minSessions}</strong> &nbsp;·&nbsp;
        Hours coded: <strong>${bi.calibrationHours}/${bi.minHours}h</strong>
      </div>
      <div class="calib-bar-track"><div class="calib-bar-fill" style="width:${bi.calibrationProgress}%"></div></div>
      <div class="calib-pct">${bi.calibrationProgress}% complete</div>
    </div>`
  : `<div class="baseline-badge">✓ Personal Baseline Active · personalised scoring</div>`;

  const compTabsHtml = `<div class="period-tabs">
    <button class="ptab ${periodMode==='weekly'?'active':''}" data-action="setPeriod" data-mode="weekly">Weekly</button>
    <button class="ptab ${periodMode==='monthly'?'active':''}" data-action="setPeriod" data-mode="monthly">Monthly</button>
  </div>`;

  document.getElementById('content').innerHTML = `
    ${calibBanner}
    ${devChipHtml}
    ${readingChipHtml}
    <div class="sec">Overview</div>
    <div class="mcards">
      <div class="mc"><div class="mc-lbl">Current Score</div><div class="mc-val" style="color:${scoreColor(displayScore)}">${displayScore}/100</div><div class="mc-sub">${isCalibrating?'rule-based':'personalised'}</div></div>
      <div class="mc"><div class="mc-lbl">Status</div><div class="mc-val" style="color:${scoreColor(displayScore)}">${displayLabel}</div></div>
      <div class="mc"><div class="mc-lbl">Session Avg</div><div class="mc-val">${avgBaseline||avgRaw}</div><div class="mc-sub">${avgBaseline?'personalised':'rule-based'}</div></div>
      <div class="mc"><div class="mc-lbl">High Load</div><div class="mc-val">${highLoad}/${features.length}</div><div class="mc-sub">sessions ≥60</div></div>
      <div class="mc"><div class="mc-lbl">KPM</div><div class="mc-val">${kpm}</div><div class="mc-sub">keystrokes/min</div></div>
      <div class="mc"><div class="mc-lbl">Total Hours</div><div class="mc-val">${totalHours}h</div><div class="mc-sub">this device</div></div>
    </div>
    <div class="sec">Current Cognitive Load</div>
    <div class="gauge-wrap"><canvas id="c_gauge"></canvas></div>
    ${secHtml('Score Trend', 'trend')}
    ${infoPopHtml('trend')}
    <div class="cw"><canvas id="c_trend"></canvas>
      <div class="xlbl"><span>${xL}</span><span>${xR}</span></div>
    </div>
    ${secHtml('Score Breakdown by Category', 'break')}
    ${infoPopHtml('break')}
    <div class="cw"><canvas id="c_break"></canvas>
      <div class="leg">
        <span><span class="ld" style="background:#00B4D8"></span>Typing</span>
        <span><span class="ld" style="background:#FF4B7D"></span>Errors</span>
        <span><span class="ld" style="background:#F39C12"></span>Context</span>
        <span><span class="ld" style="background:#FF8C42"></span>Session</span>
      </div>
    </div>
    ${secHtml('Error Density', 'err')}
    ${infoPopHtml('err')}
    <div class="cw"><canvas id="c_err"></canvas>
      <div class="leg">
        <span><span class="ld" style="background:#FF4B7D"></span>Avg Error Rate</span>
        <span><span class="ld" style="background:#FF8C42;opacity:.8"></span>Peak Error Rate</span>
      </div>
    </div>
    ${secHtml('Context Switching', 'ctx')}
    ${infoPopHtml('ctx')}
    <div class="cw"><canvas id="c_ctx"></canvas>
      <div class="leg">
        <span><span class="ld" style="background:#00B4D8;opacity:.75"></span>Switch Freq/10 min</span>
        <span><span class="ld" style="background:#FF4B7D"></span>Rapid Switches</span>
      </div>
    </div>
    ${secHtml('Deep Work vs Idle Time', 'dw')}
    ${infoPopHtml('dw')}
    <div class="cw"><canvas id="c_dw"></canvas>
      <div class="leg">
        <span><span class="ld" style="background:#1ABC9C"></span>Deep Work (min)</span>
        <span><span class="ld" style="background:#FF8C42"></span>Idle Time (min)</span>
      </div>
    </div>
    ${secHtml('Cognitive Load Heatmap', 'heat')}
    ${infoPopHtml('heat')}
    <div class="hmwrap"><canvas id="c_heat"></canvas>
      <div class="hmleg"><span>Low</span><div class="hmgrad"></div><span>High</span></div>
    </div>
    <div class="sec">Performance Comparison</div>
    ${compTabsHtml}
    ${renderComparison(ps, periodMode)}
    <div class="sec">Alert History</div>
    ${alertHtml}
    ${renderDangerZone()}
  `;

  requestAnimationFrame(()=>{
    drawGauge('c_gauge', displayScore, displayLabel);
    drawTrend(features);
    drawBreakdown(features);
    drawErrors(features);
    drawContext(features);
    drawDeepWork(features);
    drawHeatmap(features);
  });
});
