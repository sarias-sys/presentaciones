(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const nf=n=>Number(n).toLocaleString('es-CO');
const {MOTIVOS,EXT,EXTNUM,RES,ESTADO,TEMAS,FRANJAS,esFestivo,enHorario,franjaDe,NOW,PREP,TPL,transcript,finish,base,payload}=CRM;
const calls=CRM.calls;
const EXTK=['citas','siau','laboratorio','facturacion','informacion'];
const DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],DOWL=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const day0=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fmtD=d=>DOW[d.getDay()].toLowerCase()+' '+d.getDate()+' '+MES[d.getMonth()];
const fmtT=d=>fmtD(d)+' · '+d.toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'});
const first=n=>String(n).split(' ')[0];
/* Tarifa del asistente de voz: $650 por minuto, tarificado por segundo. */
const PRECIO_MIN=650,PRECIO_SEG=PRECIO_MIN/60;
const costo=c=>c.duracion_s*PRECIO_SEG;
const cop=v=>'$'+nf(Math.round(v));
const mmss=s=>Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0');

/* ===== Estado de filtros ===== */
const F={preset:'30d',from:null,to:null,ext:'',mot:'',esp:'',franja:'',hor:'',dia:'',res:'',est:'',q:''};
let view='resumen',gran=null,serie='final',cmpGran='semana',naBy='franja',bandeja='todas',sel=null,tplSel='confirmacion',tab='datos',limit=60;
function setPreset(p){F.preset=p;const t=day0(NOW);
  if(p==='hoy'){F.from=t;F.to=t}
  else if(p==='7d'){F.from=addD(t,-6);F.to=t}
  else if(p==='30d'){F.from=addD(t,-29);F.to=t}
  else if(p==='mes'){F.from=new Date(t.getFullYear(),t.getMonth(),1);F.to=t}
  else if(p==='mesant'){F.from=new Date(t.getFullYear(),t.getMonth()-1,1);F.to=new Date(t.getFullYear(),t.getMonth(),0)}
  else {F.from=new Date(2026,7,1);F.to=t}
  gran=null}
const toEnd=d=>{const x=new Date(d);x.setHours(23,59,59,999);return x};
const ndays=()=>Math.round((F.to-F.from)/864e5)+1;
function prevRange(){const n=ndays();return [addD(F.from,-n),addD(F.from,-1)]}

function pasaNoFecha(c){
  if(F.ext&&(F.ext==='ninguna'?c.requiere_transferencia:c.extension_destino!==F.ext))return false;
  if(F.mot&&c.motivo_llamada!==F.mot)return false;
  if(F.esp&&c.especialidad!==F.esp)return false;
  if(F.franja&&c.franja!==F.franja)return false;
  if(F.hor==='dentro'&&!c.en_horario)return false;
  if(F.hor==='fuera'&&c.en_horario)return false;
  if(F.dia){const w=c.hora_llamada.getDay(),fe=esFestivo(c.hora_llamada);
    if(F.dia==='habil'&&(w===0||w===6||fe))return false;
    if(F.dia==='sabado'&&w!==6)return false;
    if(F.dia==='domfest'&&!(w===0||fe))return false;
    if(/^\d$/.test(F.dia)&&w!==+F.dia)return false}
  if(F.res==='req'&&!c.requiere_transferencia)return false;
  if(F.res&&F.res!=='req'&&c.resultado_transferencia!==F.res)return false;
  if(F.est&&c.estado!==F.est)return false;
  if(F.q){const q=F.q.toLowerCase();if(![c.nombre_completo,c.cedula_paciente,c.telefono_contacto,c.id].join(' ').toLowerCase().includes(q))return false}
  return true}
const enRango=(c,a,b)=>c.hora_llamada>=a&&c.hora_llamada<=toEnd(b);
let CUR=[],PREV=[];
function aplicar(){CUR=calls.filter(c=>enRango(c,F.from,F.to)&&pasaNoFecha(c));const [a,b]=prevRange();PREV=calls.filter(c=>enRango(c,a,b)&&pasaNoFecha(c))}

function S(l){const t=l.length,o={t,basic:0,solved:0,citas:0,gest:0,req:0,ok:0,nc:0,fh:0,urg:0,dur:0,durSolved:0,sinOrden:0};
  for(const c of l){if(c.consulta_basica)o.basic++;if(c.resuelta_por_asistente)o.solved++;if(c.motivo_llamada==='cita_nueva'){o.citas++;if(c.tiene_orden===false)o.sinOrden++}if(c.motivo_llamada==='gestion_cita')o.gest++;
    if(c.requiere_transferencia){o.req++;if(c.resultado_transferencia==='exitosa')o.ok++;else if(c.resultado_transferencia==='no_contesto')o.nc++;else o.fh++}
    if(c.urgencia_detectada)o.urg++;o.dur+=c.duracion_s;if(c.resuelta_por_asistente)o.durSolved+=c.duracion_s}
  o.durAvg=t?o.dur/t:0;o.cost=o.dur*PRECIO_SEG;o.costAvg=t?o.cost/t:0;o.costSolved=o.durSolved*PRECIO_SEG;o.costPerSolved=o.solved?o.costSolved/o.solved:0;o.min=o.dur/60;o.pBasic=t?o.basic/t*100:0;o.pSolved=t?o.solved/t*100:0;o.pOk=o.req?o.ok/o.req*100:0;o.pNc=o.req?o.nc/o.req*100:0;o.pFh=o.req?o.fh/o.req*100:0;o.pReq=t?o.req/t*100:0;return o}

/* ===== Gráficos SVG (colores por variables CSS: cambian con el tema) ===== */
const FIN=[['lucia','Resuelta por Lucía','var(--accent)'],['ok','Transferida con éxito','var(--good)'],['nc','No contestó la extensión','var(--bad)'],['fh','Fuera de horario','var(--warn)']];
const finKey=c=>!c.requiere_transferencia?'lucia':c.resultado_transferencia==='exitosa'?'ok':c.resultado_transferencia==='no_contesto'?'nc':'fh';
function niceMax(v){if(v<=5)return 5;const p=Math.pow(10,Math.floor(Math.log10(v))),m=v/p;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p}
const cw=svg=>Math.max(560,Math.round((svg.parentElement.clientWidth||900)-28));
const T=(x,y,t,a='middle',cls='ax')=>`<text x="${x}" y="${y}" text-anchor="${a}" class="${cls}">${t}</text>`;

function buckets(g,a,b){const out=[];let d=day0(a);const end=day0(b);
  if(g==='dia'){for(;d<=end;d=addD(d,1))out.push({k:iso(d),a:new Date(d),b:new Date(d),l:fmtD(d),s:d.getDate()+' '+MES[d.getMonth()]})}
  else if(g==='semana'){d=addD(d,-((d.getDay()+6)%7));for(;d<=end;d=addD(d,7)){const e=addD(d,6);out.push({k:iso(d),a:new Date(d<a?day0(a):d),b:e>end?end:e,l:'Semana del '+d.getDate()+' '+MES[d.getMonth()],s:d.getDate()+' '+MES[d.getMonth()]})}}
  else{d=new Date(d.getFullYear(),d.getMonth(),1);for(;d<=end;d=new Date(d.getFullYear(),d.getMonth()+1,1)){const e=new Date(d.getFullYear(),d.getMonth()+1,0);out.push({k:iso(d),a:d<a?day0(a):new Date(d),b:e>end?end:e,l:MES[d.getMonth()].replace(/^./,m=>m.toUpperCase())+' '+d.getFullYear(),s:MES[d.getMonth()]})}}
  return out}
function bucketOf(g,d){if(g==='dia')return iso(day0(d));if(g==='semana'){const x=day0(d);return iso(addD(x,-((x.getDay()+6)%7)))}return iso(new Date(d.getFullYear(),d.getMonth(),1))}

function stacked(svg,cols,keys,opt={}){
  const W=cw(svg),H=opt.h||260,L=opt.money?66:44,R=10,Tp=14,B=30;const n=cols.length;
  const tot=cols.map(c=>keys.reduce((a,[k])=>a+(c.v[k]||0),0));const max=niceMax(Math.max(1,...tot));
  const bw=(W-L-R)/n,y=v=>Tp+(H-Tp-B)*(1-v/max);let s='';
  if(opt.band)s+=opt.band(L,bw,Tp,H-B);
  for(let i=0;i<=4;i++){const v=max/4*i;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`+T(L-6,y(v)+4,opt.money?'$'+(v>=1e6?(v/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})+' M':v>=1e3?nf(Math.round(v/1e3))+' mil':nf(Math.round(v))):nf(Math.round(v)),'end')}
  const step=Math.ceil(n/(opt.maxLabels||12));
  cols.forEach((c,i)=>{const x=L+i*bw+bw*.14,w=Math.max(1,bw*.72);let yb=H-B;
    keys.forEach(([k,lab,col])=>{const v=c.v[k]||0;if(!v)return;const h=(H-Tp-B)*v/max;yb-=h;s+=`<rect x="${x.toFixed(1)}" y="${yb.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" style="fill:${col}"><title>${esc(c.l)} · ${lab}: ${opt.money?cop(v):nf(v)}</title></rect>`});
    if(i%step===0)s+=T(L+i*bw+bw/2,H-10,esc(c.s))});
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=s}
function lines(svg,cols,series){
  const W=cw(svg),H=260,L=44,R=10,Tp=14,B=30,n=cols.length,bw=(W-L-R)/n,y=v=>Tp+(H-Tp-B)*(1-v/100);let s='';
  for(let i=0;i<=4;i++){const v=25*i;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`+T(L-6,y(v)+4,v+' %','end')}
  const step=Math.ceil(n/12);cols.forEach((c,i)=>{if(i%step===0)s+=T(L+i*bw+bw/2,H-10,esc(c.s))});
  series.forEach(([k,lab,col])=>{const pts=cols.map((c,i)=>c.v[k]==null?null:[L+i*bw+bw/2,y(c.v[k])]);
    s+=`<polyline fill="none" style="stroke:${col}" stroke-width="2.2" stroke-linejoin="round" points="${pts.filter(Boolean).map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ')}"/>`;
    pts.forEach((p,i)=>{if(p)s+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${n>40?1.6:3}" style="fill:${col}"><title>${esc(cols[i].l)} · ${lab}: ${Math.round(cols[i].v[k])} %</title></circle>`})});
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=s}
const legend=keys=>keys.map(([,l,c])=>`<span><i style="background:${c}"></i>${l}</span>`).join('');
function hbars(list,opt={}){const max=Math.max(1,...list.map(x=>x.v));
  return `<div class="hb">${list.map(x=>`<button type="button" class="hbr${x.on?' on':''}" ${x.attr||''}><span class="hl">${esc(x.l)}</span><span class="ht"><i style="width:${x.v/max*100}%;background:${x.c||'var(--accent)'}"></i></span><span class="hv">${nf(x.v)}${opt.tot?` <small>${pct(x.v,opt.tot)} %</small>`:''}</span></button>`).join('')}</div>`}

/* ===== Filtros: UI ===== */
function fillSelects(){
  const add=(id,pairs)=>{const s=$(id);pairs.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;s.appendChild(o)})};
  add('#fExt',EXTK.map(k=>[k,EXT[k]+' (ext. '+EXTNUM[k]+')']).concat([['ninguna','Sin transferencia']]));
  add('#fMot',Object.entries(MOTIVOS).map(([k,v])=>[k,v.n]));
  add('#fEsp',[...new Set(calls.map(c=>c.especialidad).filter(Boolean))].sort().map(e=>[e,e]));
  add('#fFranja',FRANJAS.map(([k,n,a,b])=>[k,n+' ('+a+'–'+b+' h)']));
}
const FMAP={ext:'#fExt',mot:'#fMot',esp:'#fEsp',franja:'#fFranja',hor:'#fHor',dia:'#fDia',res:'#fRes',est:'#fEst',q:'#q'};
function syncUI(){
  Object.entries(FMAP).forEach(([k,id])=>{$(id).value=F[k]});
  $('#fDesde').value=iso(F.from);$('#fHasta').value=iso(F.to);
  $$('#presets button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===F.preset));
  $$('.views [data-v]').forEach(b=>b.setAttribute('aria-selected',b.dataset.v===view));
  $$('.view').forEach(v=>v.hidden=v.id!=='v-'+view);
}
function chipsUI(){
  const opt=id=>{const s=$(id);return s.options[s.selectedIndex]?.textContent};
  const ch=Object.entries(FMAP).filter(([k])=>F[k]).map(([k,id])=>`<button type="button" class="chip" data-k="${k}">${esc(k==='q'?'«'+F.q+'»':opt(id))} <span aria-hidden="true">×</span></button>`);
  $('#fChips').innerHTML=ch.join('');
  $$('#fChips .chip').forEach(b=>b.onclick=()=>{F[b.dataset.k]='';update()});
  $('#fCount').textContent=nf(CUR.length)+(CUR.length===1?' llamada':' llamadas');
  $('#fRange').textContent=(F.preset==='hoy'?'hoy, ':'')+fmtD(F.from)+(+F.from===+F.to?'':' – '+fmtD(F.to))+' · '+ndays()+(ndays()===1?' día':' días');
}

/* ===== Vista: Resumen ===== */
function delta(a,b,mode,goodUp){if(!PREV.length)return '<small class="dl">sin periodo anterior</small>';
  let d,txt;if(mode==='pp'){d=a-b;txt=(d>0?'+':'')+d.toFixed(1).replace('.',',')+' pp'}else{d=b?(a-b)/b*100:0;txt=(d>0?'+':'')+Math.round(d)+' %'}
  const cls=Math.abs(d)<0.5?'':goodUp==null?'':(d>0)===goodUp?'up':'down';
  return `<small class="dl ${cls}">${d>0?'▲':d<0?'▼':'='} ${txt} <span>vs periodo anterior</span></small>`}
function vResumen(){
  const s=S(CUR),p=S(PREV);
  renderDecide();
  const K=(lbl,val,sub,d,g,sk)=>`<div class="kpi${g?' g':''}"><span class="lbl">${lbl}</span><b>${val}</b><small>${sub}</small>${d}${sk||''}</div>`;
  $('#kpis').innerHTML=
    K('Llamadas',nf(s.t),'recibidas por Lucía',delta(s.t,p.t,'n',null),0,spark(x=>x.t))+
    K('Consultas básicas',Math.round(s.pBasic)+' %',nf(s.basic)+' solo pedían información',delta(s.pBasic,p.pBasic,'pp',null),1,spark(x=>x.pBasic))+
    K('Resueltas sin asesor',Math.round(s.pSolved)+' %',nf(s.solved)+' no pasaron a una persona',delta(s.pSolved,p.pSolved,'pp',true),1,spark(x=>x.pSolved))+
    K('Citas solicitadas',nf(s.citas),nf(s.sinOrden)+' sin orden médica',delta(s.citas,p.citas,'n',null),0,spark(x=>x.citas))+
    K('Transferencias con éxito',Math.round(s.pOk)+' %',nf(s.ok)+' de '+nf(s.req)+' que la requerían',delta(s.pOk,p.pOk,'pp',true),0,spark(x=>x.req?x.pOk:null))+
    K('Duración promedio',mmss(s.durAvg),'minutos por llamada',delta(s.durAvg,p.durAvg,'n',false),0,spark(x=>x.durAvg));
  /* barra de resultado */
  const cnt={lucia:s.solved,ok:s.ok,nc:s.nc,fh:s.fh};
  $('#outbar').innerHTML=FIN.map(([k,l,c])=>cnt[k]?`<i style="flex:${cnt[k]};background:${c}" title="${l}: ${cnt[k]}"><span>${pct(cnt[k],s.t)} %</span></i>`:'').join('');
  $('#outleg').innerHTML=FIN.map(([k,l,c])=>`<button type="button" class="lg" data-r="${k}"><i style="background:${c}"></i>${l} · <b>${nf(cnt[k])}</b></button>`).join('');
  $$('#outleg .lg').forEach(b=>b.onclick=()=>{F.res={lucia:'no_aplica',ok:'exitosa',nc:'no_contesto',fh:'fuera_de_horario'}[b.dataset.r];update()});
  /* costos */
  const dias=ndays(),proy=s.cost/dias*30;
  const C=(lbl,val,sub,d)=>`<div class="kpi"><span class="lbl">${lbl}</span><b>${val}</b><small>${sub}</small>${d||''}</div>`;
  $('#costos').innerHTML=
    C('Costo del periodo',cop(s.cost),nf(Math.round(s.min))+' minutos de asistente',delta(s.cost,p.cost,'n',null))+
    C('Costo por llamada',cop(s.costAvg),'promedio · '+mmss(s.durAvg)+' min',delta(s.costAvg,p.costAvg,'n',false))+
    C('Costo de las resueltas sin asesor',cop(s.costSolved),nf(s.solved)+' llamadas · '+cop(s.costPerSolved)+' cada una')+
    C('Proyección a 30 días',cop(proy),'al ritmo del periodo elegido ('+dias+(dias===1?' día':' días')+')');
  const cm=Object.entries(MOTIVOS).map(([k,v])=>{const l=CUR.filter(c=>c.motivo_llamada===k);return {l:v.n,v:l.reduce((a,c)=>a+costo(c),0),c:v.c,n:l.length}}).filter(x=>x.n).sort((a,b)=>b.v-a.v);
  const mxc=Math.max(1,...cm.map(x=>x.v));
  $('#costoMot').innerHTML=`<div class="hb">${cm.map(x=>`<div class="hbr"><span class="hl">${esc(x.l)}</span><span class="ht"><i style="width:${x.v/mxc*100}%;background:${x.c}"></i></span><span class="hv">${cop(x.v)} <small>${pct(x.v,s.cost)} %</small></span></div>`).join('')}</div>`;
  /* evolución */
  const g=gran||(ndays()<=21?'dia':ndays()<=120?'semana':'mes');
  $$('#gran button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===g));$$('#serie button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===serie));
  const bk=buckets(g,F.from,F.to),idx=Object.fromEntries(bk.map((b,i)=>[b.k,i]));const groups=bk.map(()=>[]);
  CUR.forEach(c=>{const i=idx[bucketOf(g,c.hora_llamada)];if(i!=null)groups[i].push(c)});
  if(serie==='pct'){const cols=bk.map((b,i)=>{const t=S(groups[i]);return {...b,v:t.t?{b:t.pBasic,s:t.pSolved,o:t.req?t.pOk:null}:{}}});
    const ser=[['s','Resueltas sin asesor','var(--accent)'],['b','Consultas básicas','oklch(0.6 0.13 350)'],['o','Éxito de transferencia','var(--good)']];
    lines($('#evo'),cols,ser);$('#evoleg').innerHTML=legend(ser)}
  else if(serie==='motivo'){const keys=Object.entries(MOTIVOS).map(([k,v])=>[k,v.n,v.c]);
    stacked($('#evo'),bk.map((b,i)=>{const v={};groups[i].forEach(c=>v[c.motivo_llamada]=(v[c.motivo_llamada]||0)+1);return {...b,v}}),keys);$('#evoleg').innerHTML=legend(keys)}
  else if(serie==='costo'){stacked($('#evo'),bk.map((b,i)=>{const v={};groups[i].forEach(c=>{const k=finKey(c);v[k]=(v[k]||0)+costo(c)});return {...b,v}}),FIN,{money:true});$('#evoleg').innerHTML=legend(FIN)+'<span>Valores en pesos: $650 por minuto, por segundo</span>'}
  else{stacked($('#evo'),bk.map((b,i)=>{const v={};groups[i].forEach(c=>{const k=finKey(c);v[k]=(v[k]||0)+1});return {...b,v}}),FIN);$('#evoleg').innerHTML=legend(FIN)}
  heat();
  /* franjas */
  $('#franjas').innerHTML=`<div class="fr">${FRANJAS.map(([k,n,a,b])=>{const l=CUR.filter(c=>c.franja===k),v={lucia:0,ok:0,nc:0,fh:0};l.forEach(c=>v[finKey(c)]++);
    return `<button type="button" class="frr${F.franja===k?' on':''}" data-f="${k}"><span class="hl">${n}<small>${a}–${b} h</small></span><span class="ht st">${FIN.map(([kk,ll,cc])=>v[kk]?`<i style="flex:${v[kk]};background:${cc}" title="${ll}: ${v[kk]}"></i>`:'').join('')}<em style="flex:${Math.max(0,maxFr()-l.length)}"></em></span><span class="hv">${nf(l.length)} <small>${pct(l.length,CUR.length)} %</small></span></button>`}).join('')}</div><div class="legend">${legend(FIN)}</div>`;
  $$('#franjas .frr').forEach(b=>b.onclick=()=>{F.franja=F.franja===b.dataset.f?'':b.dataset.f;update()});
  /* motivo */
  const rowsM=Object.entries(MOTIVOS).map(([k,v])=>{const l=CUR.filter(c=>c.motivo_llamada===k),t=S(l);return [k,v,t]}).filter(r=>r[2].t);
  $('#tMot').innerHTML=`<table><thead><tr><th>Motivo</th><th>Llamadas</th><th>% del total</th><th>Resueltas por Lucía</th><th>Éxito transf.</th><th>Duración</th><th>Costo</th></tr></thead><tbody>${rowsM.map(([k,v,t])=>`<tr class="click${F.mot===k?' on':''}" data-m="${k}"><td><i class="dot" style="background:${v.c}"></i>${v.n}</td><td>${nf(t.t)}</td><td><span class="cbar"><i style="width:${pct(t.t,CUR.length)}%"></i></span>${pct(t.t,CUR.length)} %</td><td>${Math.round(t.pSolved)} %</td><td>${t.req?Math.round(t.pOk)+' %':'—'}</td><td>${mmss(t.durAvg)}</td><td>${cop(t.cost)}</td></tr>`).join('')}</tbody></table>`;
  $$('#tMot tr[data-m]').forEach(r=>r.onclick=()=>{F.mot=F.mot===r.dataset.m?'':r.dataset.m;update()});
  /* especialidad */
  const ce=CUR.filter(c=>c.especialidad);const esps=[...new Set(ce.map(c=>c.especialidad))];
  const rowsE=esps.map(e=>{const l=ce.filter(c=>c.especialidad===e),n=l.filter(c=>c.motivo_llamada==='cita_nueva');return {e,t:l.length,n:n.length,g:l.length-n.length,pv:n.filter(c=>c.tipo_cita==='primera_vez').length,so:n.filter(c=>c.tiene_orden===false).length,pc:l.filter(c=>c.estado==='por_confirmar').length}}).sort((a,b)=>b.t-a.t);
  $('#tEsp').innerHTML=rowsE.length?`<table><thead><tr><th>Especialidad</th><th>Citas nuevas</th><th>Primera vez</th><th>Gestión</th><th>Sin orden</th><th>Por confirmar</th></tr></thead><tbody>${rowsE.map(r=>`<tr class="click${F.esp===r.e?' on':''}" data-e="${esc(r.e)}"><td>${esc(r.e)}</td><td>${r.n}</td><td>${r.n?pct(r.pv,r.n)+' %':'—'}</td><td>${r.g}</td><td>${r.so}</td><td>${r.pc?`<span class="tag wa">${r.pc}</span>`:'0'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Sin citas en este filtro.</div>';
  $$('#tEsp tr[data-e]').forEach(r=>r.onclick=()=>{F.esp=F.esp===r.dataset.e?'':r.dataset.e;update()});
  /* temas y EPS */
  const ib=CUR.filter(c=>c.motivo_llamada==='informacion_basica');
  $('#temas').innerHTML=ib.length?hbars(Object.entries(TEMAS).map(([k,n])=>({l:n,v:ib.filter(c=>c.tema_consulta===k).length,c:k==='fuera_guia'?'var(--warn)':'var(--accent)'})).filter(x=>x.v).sort((a,b)=>b.v-a.v),{tot:ib.length})+`<p class="note">«No está en la guía» se transfiere a información. Lo que más se repite ahí es lo próximo que conviene agregar al asistente.</p>`:'<div class="empty">Sin consultas de información en este filtro.</div>';
  const ce2=CUR.filter(c=>c.eps);const ec={};ce2.forEach(c=>ec[c.eps]=(ec[c.eps]||0)+1);
  $('#eps').innerHTML=ce2.length?hbars(Object.entries(ec).sort((a,b)=>b[1]-a[1]).map(([l,v])=>({l,v,c:l==='Otra'?'var(--ink-3)':'var(--accent)'})),{tot:ce2.length})+`<p class="note">Solo llamadas en las que se preguntó la EPS (citas, resultados, PQRS).</p>`:'<div class="empty">Sin datos de EPS.</div>';
}
function maxFr(){return Math.max(...FRANJAS.map(([k])=>CUR.filter(c=>c.franja===k).length))}
function heat(){
  const W=cw($('#heat')),H=7*24+34,L=44,Tp=8,B=26,R=8,cW=(W-L-R)/24,ch=(H-Tp-B)/7,order=[1,2,3,4,5,6,0];
  const m=order.map(()=>Array(24).fill(0));CUR.forEach(c=>{m[order.indexOf(c.hora_llamada.getDay())][c.hora_llamada.getHours()]++});
  const max=Math.max(1,...m.flat());let s='';
  order.forEach((w,r)=>{s+=T(L-8,Tp+r*ch+ch/2+4,DOW[w],'end');
    for(let h=0;h<24;h++){const v=m[r][h];s+=`<rect x="${(L+h*cW+1).toFixed(1)}" y="${(Tp+r*ch+1).toFixed(1)}" width="${(cW-2).toFixed(1)}" height="${(ch-2).toFixed(1)}" rx="2" style="fill:${v?'var(--accent)':'var(--sunken)'}" opacity="${v?(0.12+0.88*v/max).toFixed(2):1}"><title>${DOWL[w]} ${h}:00–${h+1}:00 · ${v} llamadas</title></rect>`}});
  for(let h=0;h<24;h+=3)s+=T(L+h*cW+cW/2,H-8,h+' h');
  s+=`<rect x="${L+8*cW}" y="${Tp}" width="${10*cW}" height="${5*ch}" class="band"/><rect x="${L+8*cW}" y="${Tp+5*ch}" width="${5*cW}" height="${ch}" class="band"/>`;
  $('#heat').setAttribute('viewBox',`0 0 ${W} ${H}`);$('#heat').innerHTML=s}

/* ===== Vista: Por extensión ===== */
function vExt(){
  const reqAll=CUR.filter(c=>c.requiere_transferencia);
  $('#extcards').innerHTML=EXTK.map(k=>{const t=S(reqAll.filter(c=>c.extension_destino===k));
    return `<button type="button" class="extc${F.ext===k?' on':''}" data-x="${k}"><span class="lbl">Ext. ${EXTNUM[k]}</span><b>${EXT[k]}</b><span class="big">${nf(t.req)}<small> transferencias</small></span><span class="mini">${t.req?`<i class="s-ok" style="flex:${t.ok}"></i><i class="s-nc" style="flex:${t.nc}"></i><i class="s-fh" style="flex:${t.fh}"></i>`:''}</span><span class="ex"><span>Éxito <b>${Math.round(t.pOk)} %</b></span><span>No contestó <b>${nf(t.nc)}</b></span><span>Fuera hor. <b>${nf(t.fh)}</b></span></span></button>`}).join('');
  $$('#extcards .extc').forEach(b=>b.onclick=()=>{F.ext=F.ext===b.dataset.x?'':b.dataset.x;update()});
  $('#extTitle').textContent='Transferencias por hora · '+(F.ext&&F.ext!=='ninguna'?'extensión de '+EXT[F.ext]:'todas las extensiones');
  const cols=[...Array(24).keys()].map(h=>{const v={ok:0,nc:0,fh:0};reqAll.forEach(c=>{if(c.hora_llamada.getHours()===h)v[finKey(c)]++});return {l:h+':00',s:h+' h',v}});
  stacked($('#extHour'),cols,FIN.slice(1),{h:240,maxLabels:12,band:(L,bw,t,b)=>`<rect x="${L+8*bw}" y="${t}" width="${10*bw}" height="${b-t}" class="okband"/>`+T(L+13*bw,t+12,'horario L–V 8–18 · sábado hasta 13','middle','ax')});
  /* tabla de no contesta */
  $$('#naBy button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.n===naBy));
  const inH=reqAll.filter(c=>c.en_horario);
  const colsNa=naBy==='franja'?FRANJAS.filter(f=>f[2]>=8&&f[2]<18).map(([k,n,a,b])=>[n+' '+a+'–'+b,c=>c.franja===k]):[1,2,3,4,5,6].map(w=>[DOW[w],c=>c.hora_llamada.getDay()===w]);
  const cell=l=>{if(!l.length)return '<td class="na">—</td>';const p=pct(l.filter(c=>c.resultado_transferencia==='no_contesto').length,l.length);return `<td class="na" style="--a:${Math.min(1,p/45)}"><b>${p} %</b> <small>(${l.length})</small></td>`};
  $('#tNa').innerHTML=`<table class="heatt"><thead><tr><th>Extensión</th>${colsNa.map(c=>`<th>${c[0]}</th>`).join('')}<th>Total</th></tr></thead><tbody>${EXTK.map(k=>{const l=inH.filter(c=>c.extension_destino===k);return `<tr${F.ext===k?' class="on"':''}><td>${EXT[k]}</td>${colsNa.map(([,f])=>cell(l.filter(f))).join('')}${cell(l)}</tr>`}).join('')}</tbody></table>`;
  /* por devolver */
  const cb=CUR.filter(c=>c.estado==='devolver_llamada');$('#cbCount').textContent=cb.length+(cb.length===1?' llamada':' llamadas');
  $('#cbList').innerHTML=cb.length?cb.slice(0,80).map(c=>`<button type="button" class="row" data-id="${c.id}"><span class="t">${fmtT(c.hora_llamada)}</span><div><div class="n">${esc(c.nombre_completo)}</div><div class="s">${esc(c.resumen)}</div></div><div class="tags"><span class="tag">${EXT[c.extension_destino]}</span><span class="tag ${RES[c.resultado_transferencia][1]}">${RES[c.resultado_transferencia][0]}</span></div></button>`).join(''):'<div class="empty">No hay llamadas pendientes por devolver en este filtro.</div>';
  $$('#cbList .row').forEach(b=>b.onclick=()=>openCall(b.dataset.id));
}

/* ===== Vista: Comparar ===== */
function vCmp(){
  $$('#cmpGran button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.g===cmpGran));
  let bk=buckets(cmpGran,F.from,F.to);const idx=Object.fromEntries(bk.map((b,i)=>[b.k,i]));const gr=bk.map(()=>[]);
  CUR.forEach(c=>{const i=idx[bucketOf(cmpGran,c.hora_llamada)];if(i!=null)gr[i].push(c)});
  let rows=bk.map((b,i)=>({b,s:S(gr[i])})).reverse();const cap=cmpGran==='dia'?62:cmpGran==='semana'?26:24;const cut=rows.length>cap;rows=rows.slice(0,cap);
  const COLS=[['t','Llamadas',s=>nf(s.t),s=>s.t,null],['pBasic','% básicas',s=>Math.round(s.pBasic)+' %',s=>s.pBasic,null],['pSolved','% resueltas sin asesor',s=>Math.round(s.pSolved)+' %',s=>s.pSolved,true],['citas','Citas nuevas',s=>nf(s.citas),s=>s.citas,null],['req','Requerían transf.',s=>nf(s.req),s=>s.req,null],['pOk','% éxito',s=>s.req?Math.round(s.pOk)+' %':'—',s=>s.pOk,true],['pNc','% no contestó',s=>s.req?Math.round(s.pNc)+' %':'—',s=>s.pNc,false],['pFh','% fuera de horario',s=>s.req?Math.round(s.pFh)+' %':'—',s=>s.pFh,null],['durAvg','Duración',s=>mmss(s.durAvg),s=>s.durAvg,null],['cost','Costo',s=>cop(s.cost),s=>s.cost,null],['costAvg','Costo por llamada',s=>cop(s.costAvg),s=>s.costAvg,false]];
  const mx=COLS.map(c=>Math.max(...rows.map(r=>c[3](r.s)||0)));
  const arrow=(a,b,good)=>{if(b==null)return '';const d=a-b;if(Math.abs(d)<0.5)return '<span class="ar">=</span>';const cls=good==null?'':(d>0)===good?'up':'down';return `<span class="ar ${cls}">${d>0?'▲':'▼'}</span>`};
  $('#tCmp').innerHTML=`<table class="cmp"><thead><tr><th>${{dia:'Día',semana:'Semana',mes:'Mes'}[cmpGran]}</th>${COLS.map(c=>`<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>{const nx=rows[i+1];const fe=cmpGran==='dia'&&(r.b.a.getDay()===0||esFestivo(r.b.a));
    return `<tr><td class="pl">${cmpGran==='dia'?fmtD(r.b.a)+(fe?' <span class="tag">'+(esFestivo(r.b.a)?'festivo':'domingo')+'</span>':''):esc(r.b.l)}${cmpGran!=='dia'&&(r.b.b-r.b.a)/864e5<(cmpGran==='semana'?6:27)?' <span class="tag wa">parcial</span>':''}</td>${COLS.map((c,j)=>{const v=c[3](r.s)||0;return `<td style="--a:${mx[j]?(v/mx[j]*.55).toFixed(2):0}">${c[2](r.s)} ${nx&&r.s.t&&nx.s.t?arrow(v,c[3](nx.s)||0,c[4]):''}</td>`}).join('')}</tr>`}).join('')}</tbody></table>${cut?'<p class="note">Se muestran los '+cap+' periodos más recientes del rango.</p>':''}`;
  /* día de la semana: actual vs anterior */
  const [pa,pb]=prevRange();$('#dowLbl').textContent=fmtD(F.from)+'–'+fmtD(F.to)+' vs '+fmtD(pa)+'–'+fmtD(pb);
  const order=[1,2,3,4,5,6,0],nd=(x,y,w)=>{let n=0;for(let d=day0(x);d<=y;d=addD(d,1))if(d.getDay()===w)n++;return n||1};const cnt=(l,x,y)=>order.map(w=>Math.round(l.filter(c=>c.hora_llamada.getDay()===w).length/nd(x,y,w)*10)/10);const a=cnt(CUR,F.from,F.to),b=cnt(PREV,pa,pb);
  const W=cw($('#dow')),H=240,L=40,R=8,Tp=12,B=26,max=niceMax(Math.max(1,...a,...b)),gw=(W-L-R)/7,y=v=>Tp+(H-Tp-B)*(1-v/max);let s='';
  for(let i=0;i<=4;i++){const v=max/4*i;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`+T(L-6,y(v)+4,nf(Math.round(v*10)/10),'end')}
  order.forEach((w,i)=>{const x=L+i*gw;s+=`<rect x="${x+gw*.14}" y="${y(a[i])}" width="${gw*.34}" height="${H-B-y(a[i])}" style="fill:var(--accent)"><title>${DOWL[w]} · periodo elegido: ${a[i]}</title></rect><rect x="${x+gw*.52}" y="${y(b[i])}" width="${gw*.34}" height="${H-B-y(b[i])}" style="fill:var(--line-2)"><title>${DOWL[w]} · periodo anterior: ${b[i]}</title></rect>`+T(x+gw/2,H-8,DOW[w])});
  $('#dow').setAttribute('viewBox',`0 0 ${W} ${H}`);$('#dow').innerHTML=s;
  const s1=S(CUR),s0=S(PREV);
  const RW=[['Llamadas',s1.t,s0.t,'n',nf,null],['Consultas básicas',s1.pBasic,s0.pBasic,'pp',v=>Math.round(v)+' %',null],['Resueltas sin asesor',s1.pSolved,s0.pSolved,'pp',v=>Math.round(v)+' %',true],['Citas nuevas',s1.citas,s0.citas,'n',nf,null],['Requerían transferencia',s1.req,s0.req,'n',nf,null],['Transferidas con éxito',s1.pOk,s0.pOk,'pp',v=>Math.round(v)+' %',true],['No contestó la extensión',s1.pNc,s0.pNc,'pp',v=>Math.round(v)+' %',false],['Fuera de horario',s1.pFh,s0.pFh,'pp',v=>Math.round(v)+' %',null],['Urgencias remitidas',s1.urg,s0.urg,'n',nf,null],['Duración promedio',s1.durAvg,s0.durAvg,'n',mmss,false],['Minutos del asistente',s1.min,s0.min,'n',v=>nf(Math.round(v)),null],['Costo del asistente',s1.cost,s0.cost,'n',cop,null],['Costo por llamada',s1.costAvg,s0.costAvg,'n',cop,false]];
  $('#tPrev').innerHTML=`<table><thead><tr><th>Indicador</th><th>Elegido</th><th>Anterior</th><th>Variación</th></tr></thead><tbody>${RW.map(([n,a,b,m,f,g])=>{let d,txt;if(m==='pp'){d=a-b;txt=(d>0?'+':'')+d.toFixed(1).replace('.',',')+' pp'}else{d=b?(a-b)/b*100:0;txt=b?(d>0?'+':'')+Math.round(d)+' %':'—'}const cls=Math.abs(d)<.5||g==null?'':(d>0)===g?'up':'down';return `<tr><td>${n}</td><td><b>${f(a)}</b></td><td>${PREV.length?f(b):'—'}</td><td class="dl ${cls}">${PREV.length?txt:'—'}</td></tr>`}).join('')}</tbody></table>`;
}

/* ===== Vista: Llamadas (bandejas, lista, ficha y plantillas) ===== */
const BANDEJAS=[['todas','Todas',()=>true,''],['h','Seguimiento'],['por_confirmar','Citas por confirmar',c=>c.estado==='por_confirmar','var(--warn)'],['devolver','Devolver llamada',c=>c.estado==='devolver_llamada','var(--bad)'],['enviadas','Confirmación o recordatorio enviado',c=>['confirmacion_enviada','recordatorio_enviado'].includes(c.estado),'var(--accent)'],['urg','Urgencias remitidas',c=>c.urgencia_detectada,'var(--bad)'],['h','Transferencias'],['t_ok','Transferidas con éxito',c=>c.resultado_transferencia==='exitosa','var(--good)'],['t_nc','No contestó la extensión',c=>c.resultado_transferencia==='no_contesto','var(--bad)'],['t_fh','Fuera de horario',c=>c.resultado_transferencia==='fuera_de_horario','var(--warn)'],['t_no','Resueltas por Lucía',c=>!c.requiere_transferencia,'var(--accent)']];
function tagsFor(c){
  const m=MOTIVOS[c.motivo_llamada];let h=`<span class="tag" style="color:${m.c}">${m.n}</span>`;
  if(c.urgencia_detectada)h+='<span class="tag bad">Urgencia</span>';
  else if(c.requiere_transferencia){const r=RES[c.resultado_transferencia];h+=`<span class="tag ${r[1]}">${c.resultado_transferencia==='exitosa'?'→ '+EXT[c.extension_destino]:r[0]}</span>`}
  else h+='<span class="tag ok">Resuelta por Lucía</span>';
  if(['por_confirmar','confirmacion_enviada','recordatorio_enviado','devolver_llamada'].includes(c.estado)){const s=ESTADO[c.estado];h+=`<span class="tag ${s[1]}">${s[0]}</span>`}
  return h}
function vCalls(){
  const el=$('#types');el.innerHTML='';
  BANDEJAS.forEach(([k,n,f,col])=>{if(k==='h'){const h=document.createElement('div');h.className='lbl tg';h.textContent=n;el.appendChild(h);return}
    const b=document.createElement('button');b.type='button';b.className='type'+(bandeja===k?' on':'');b.innerHTML=`<span>${col?`<i class="dot" style="background:${col}"></i>`:''}${esc(n)}</span><span class="c">${nf(CUR.filter(f).length)}</span>`;b.onclick=()=>{bandeja=k;limit=60;vCalls()};el.appendChild(b)});
  const f=BANDEJAS.find(b=>b[0]===bandeja)[2];const rows=CUR.filter(f);
  $('#listTitle').textContent=BANDEJAS.find(b=>b[0]===bandeja)[1];$('#listCount').textContent=nf(rows.length)+(rows.length===1?' llamada':' llamadas');
  const L=$('#list');
  if(!rows.length){L.innerHTML='<div class="empty">No hay llamadas con estos filtros.</div>'}
  else{L.innerHTML=rows.slice(0,limit).map(c=>`<button type="button" class="row${c.id===sel?' on':''}" data-id="${c.id}"><span class="t">${fmtT(c.hora_llamada)}</span><div><div class="n">${esc(c.nombre_completo)}</div><div class="s">${esc(c.especialidad?c.especialidad+' · ':'')}${esc(c.resumen)}</div></div><div class="tags">${tagsFor(c)}</div></button>`).join('')+(rows.length>limit?`<button type="button" class="more" id="more">Mostrar ${Math.min(60,rows.length-limit)} más · quedan ${nf(rows.length-limit)}</button>`:'');
    $$('#list .row').forEach(b=>b.onclick=()=>{selectCall(b.dataset.id);vCalls()});const m=$('#more');if(m)m.onclick=()=>{limit+=60;vCalls()}}
  if(!sel||!CUR.find(c=>c.id===sel))sel=rows[0]?.id||null;
  renderDetail();
}
function selectCall(id){sel=id;const c=calls.find(x=>x.id===id);if(!c)return;tab='datos';tplSel=c.estado==='devolver_llamada'?'devolver':c.estado==='confirmacion_enviada'?'recordatorio':(c.tiene_orden===false?'orden':'confirmacion')}
function openCall(id){const c=calls.find(x=>x.id===id);selectCall(id);bandeja='todas';
  if(!CUR.includes(c)){Object.keys(FMAP).forEach(k=>F[k]='');setPreset('todo')}
  const i=CUR.indexOf(c);limit=Math.max(60,i+1);view='llamadas';update();setTimeout(()=>{const r=document.querySelector('#list .row.on');if(r)r.scrollIntoView({block:'nearest'})},0)}
const yn=v=>v===true?'Sí':v===false?'No':'—';
function renderDetail(){
  const c=calls.find(x=>x.id===sel);const el=$('#detail');
  if(!c){el.innerHTML='<div class="empty">Seleccione una llamada.</div>';return}
  const tx=transcript(c);
  const isCita=['cita_nueva','gestion_cita'].includes(c.motivo_llamada)&&c.especialidad;
  const needsMsg=isCita||c.estado==='devolver_llamada';
  const tpls=Object.entries(TPL).filter(([k])=>c.estado==='devolver_llamada'?k==='devolver'||(isCita&&k!=='devolver'):k!=='devolver');
  if(!tpls.find(([k])=>k===tplSel)&&tpls.length)tplSel=tpls[0][0];
  const r={...c,nombre1:first(c.nombre_completo),motivoTxt:MOTIVOS[c.motivo_llamada].n.toLowerCase()};
  const rt=RES[c.resultado_transferencia];
  el.innerHTML=`
  <div class="dsec">
    <div class="dh"><div><span class="lbl">${c.id} · ${fmtT(c.hora_llamada)} · ${c.en_horario?'en horario':'fuera de horario'} · ${mmss(c.duracion_s)} min · ${cop(costo(c))}</span><h3>${esc(c.nombre_completo)}</h3></div><div class="tags">${tagsFor(c)}</div></div>
    <p class="resumen">${esc(c.resumen)}</p>
    <div class="tabs" role="tablist"><button type="button" role="tab" data-t="datos" aria-selected="${tab==='datos'}">Datos post-llamada</button><button type="button" role="tab" data-t="trans" aria-selected="${tab==='trans'}">Transcripción</button></div>
  </div>
  ${tab==='datos'?`
  <div class="dsec"><div class="fields">
    <div class="f"><span>CÉDULA</span><b>${esc(c.cedula_paciente)}</b></div>
    <div class="f"><span>TELÉFONO</span><b>${esc(c.telefono_contacto)}</b></div>
    <div class="f"><span>ESPECIALIDAD</span><b>${esc(c.especialidad||'—')}</b></div>
    <div class="f"><span>TIPO DE CITA</span><b>${c.tipo_cita==='control'?'Control':c.tipo_cita==='primera_vez'?'Primera vez':'—'}</b></div>
    <div class="f"><span>EPS</span><b>${esc(c.eps||'—')}</b></div>
    <div class="f"><span>TIENE ORDEN</span><b>${yn(c.tiene_orden)}</b></div>
    <div class="f"><span>CONSULTA BÁSICA</span><b>${yn(c.consulta_basica)}${c.tema_consulta?' · '+TEMAS[c.tema_consulta]:''}</b></div>
    <div class="f"><span>SENTIMIENTO</span><b>${{Positive:'Positivo',Neutral:'Neutral',Negative:'Negativo'}[c.sentimiento]}</b></div>
    <div class="f"><span>REQUERÍA TRANSFERENCIA</span><b>${yn(c.requiere_transferencia)}${c.requiere_transferencia?' · '+EXT[c.extension_destino]:''}</b></div>
    <div class="f"><span>RESULTADO</span><b>${rt[0]}</b></div>
    <div class="f" style="grid-column:1/-1"><span>COSTO DE LA LLAMADA</span><b>${cop(costo(c))} · ${c.duracion_s} segundos × $${(PRECIO_SEG).toLocaleString('es-CO',{maximumFractionDigits:2})} por segundo</b></div>
  </div></div>`:`
  <div class="dsec"><div class="tx">${tx.map(([q,t])=>`<p class="${q==='Lucía'?'ai':q==='Sistema'?'sys':'pt'}"><b>${q}</b>${esc(t)}</p>`).join('')}</div><p class="foot" style="margin:0">Transcripción y grabación llegan en el evento de Flow al terminar la llamada.</p></div>`}
  ${needsMsg?`
  <div class="dsec">
    <span class="lbl">Plantilla de WhatsApp</span>
    <div class="tpls" role="group" aria-label="Plantilla">${tpls.map(([k,t])=>`<button type="button" class="tpl" data-k="${k}" aria-pressed="${k===tplSel}">${t.n}</button>`).join('')}</div>
    ${['confirmacion','reprogramar','recordatorio'].includes(tplSel)?`<div class="slots">
      <label>Fecha<input id="sFecha" value="${esc(c.fecha)}" placeholder="martes 10 de noviembre"></label>
      <label>Hora<input id="sHora" value="${esc(c.hora)}" placeholder="8:20 a. m."></label>
      <label style="grid-column:1/-1">Especialista<input id="sEsp" value="${esc(c.especialista)}" placeholder="Dra. … (${esc((c.especialidad||'').toLowerCase())})"></label>
    </div>`:''}
    <div class="waprev"><div class="bubble" id="bubble">${esc(TPL[tplSel].body(r))}<small>Para ${esc(c.telefono_contacto)} · plantilla ${esc(TPL[tplSel].n.toLowerCase())}</small></div></div>
    <div class="acts"><button type="button" class="btn" id="send">Enviar plantilla</button><button type="button" class="btn gh" id="close">Cerrar caso</button></div>
  </div>`:`<div class="dsec"><span class="lbl">Acción</span><p class="resumen">${c.urgencia_detectada?'Revisar si la persona llegó a urgencias. No requiere plantilla.':c.transferida?'Atendida por la extensión de '+EXT[c.extension_destino]+'.':'Lucía resolvió la consulta. No requiere seguimiento.'}</p></div>`}
  <div class="dsec">
    <span class="lbl">Historial</span>
    <div class="log">${[{t:c.hora_llamada,txt:'Llamada atendida por Lucía; llegó el evento de Flow con los datos post-llamada'}].concat(c.envios).map(e=>`<div><span>${fmtT(e.t)}</span><p style="margin:0">${esc(e.txt)}</p></div>`).join('')}</div>
    <details><summary>Ver el evento que envió Flow</summary><pre>${esc(JSON.stringify(payload(c),null,2))}</pre></details>
  </div>`;
  el.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;renderDetail()});
  el.querySelectorAll('.tpl').forEach(b=>b.onclick=()=>{tplSel=b.dataset.k;renderDetail()});
  ['sFecha','sHora','sEsp'].forEach(id=>{const i=document.getElementById(id);if(i)i.oninput=()=>{c.fecha=$('#sFecha').value;c.hora=$('#sHora').value;c.especialista=$('#sEsp').value;$('#bubble').firstChild.textContent=TPL[tplSel].body({...c,nombre1:first(c.nombre_completo),motivoTxt:MOTIVOS[c.motivo_llamada].n.toLowerCase()})}});
  const s=$('#send');if(s)s.onclick=()=>{
    if(['confirmacion','reprogramar'].includes(tplSel)&&(!c.fecha||!c.hora||!c.especialista)){toast('Complete fecha, hora y especialista antes de enviar.');return}
    c.envios.push({t:new Date(),txt:`Plantilla «${TPL[tplSel].n}» enviada por WhatsApp (simulado)`});
    if(tplSel==='confirmacion'||tplSel==='reprogramar')c.estado='confirmacion_enviada';
    if(tplSel==='recordatorio')c.estado='recordatorio_enviado';
    if(tplSel==='devolver')c.estado='cerrada';
    toast(`Plantilla «${TPL[tplSel].n}» lista para ${first(c.nombre_completo)} (simulado)`);update()};
  const cl=$('#close');if(cl)cl.onclick=()=>{c.estado='cerrada';c.envios.push({t:new Date(),txt:'Caso cerrado'});toast('Caso cerrado');update()};
}

/* ===== Vista: Datos del webhook ===== */
function vHook(){
  const FL=[
   ['Identificador, inicio, fin y duración','call_id · start_timestamp · end_timestamp · duration_ms','Flow, siempre','Fecha, franja, día, duración promedio'],
   ['Número que llama','from_number','Flow, siempre','Teléfono de contacto si la persona no da otro'],
   ['Motivo de desconexión','disconnection_reason','Flow, siempre','Quién colgó y si hubo transferencia'],
   ['Transcripción y grabación','transcript · recording_url','Flow, siempre','Pestaña «Transcripción» y auditoría'],
   ['Resumen, sentimiento, llamada exitosa','call_summary · user_sentiment · call_successful','Análisis post-llamada (por defecto)','Resumen en la lista y sentimiento en la ficha'],
   ['Motivo, consulta básica, resuelta, transferida, extensión','motivo_llamada · consulta_basica · resuelta_por_asistente · transferida · extension_destino','Campos post-llamada ya configurados','Bandejas, % básicas, % resueltas, vista por extensión'],
   ['Datos de la cita','especialidad · tipo_cita · eps · tiene_orden · cedula_paciente · nombre_completo · telefono_contacto','Campos post-llamada ya configurados','Citas por confirmar, plantillas y tabla por especialidad'],
   ['Urgencia y resumen','urgencia_detectada · resumen','Campos post-llamada ya configurados','Bandeja de urgencias remitidas'],
   ['Requería transferencia y resultado','requiere_transferencia · resultado_transferencia','Por agregar en Flow','Éxito, no contestó y fuera de horario por extensión'],
   ['Tema de la consulta básica','tema_consulta','Por agregar en Flow (sugerido)','Gráfico «¿Qué preguntan?»'],
   ['Costo de la llamada','duration_ms','Calculado en el CRM: segundos × $650 / 60','Costos por periodo, motivo y llamada'],
   ['Dentro o fuera de horario, franja, festivo','—','Calculado en el CRM con la hora de inicio','Filtros de franja, día y horario'],
   ['Estado de seguimiento y envíos','—','Del CRM (lo marca el equipo)','Por confirmar, confirmación, recordatorio, devolver llamada']];
  $('#tFields').innerHTML=`<table><thead><tr><th>Dato</th><th>Campo</th><th>Origen</th><th>Para qué se usa</th></tr></thead><tbody>${FL.map(([a,b,o,u])=>`<tr><td><b>${a}</b></td><td class="mono sm">${b}</td><td><span class="tag ${/Por agregar/.test(o)?'wa':/CRM/.test(o)?'ac':'ok'}">${o}</span></td><td>${u}</td></tr>`).join('')}</tbody></table>`;
  const c=calls.find(x=>x.id===sel)||CUR[0]||calls[0];
  $('#plLbl').textContent=c.id+' · '+fmtT(c.hora_llamada);
  $('#plJson').textContent=JSON.stringify(payload(c),null,2);
}

/* ===== Para decidir: alarmas, pendientes y oportunidades ===== */
const IC={
 alert:'<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/>',
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/><path d="m16 3 5 5M21 3l-5 5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
 down:'<path d="m3 7 7 7 4-4 7 7"/><path d="M21 11v6h-6"/>',
 up:'<path d="m3 17 7-7 4 4 7-7"/><path d="M21 13V7h-6"/>',
 bulb:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
 doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6M9 14h6M9 17h4"/>',
 moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
 heart:'<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 peak:'<path d="M3 20h18M6 16v-4M10 16V8M14 16v-6M18 16V5"/>',
 coin:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .9 3 2.1-1.3 1.9-3 1.9c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>'};
const icon=(k,cls='')=>`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
let INS=[];
function insights(){
  const out=[],s=S(CUR),p=S(PREV),fr={manana:'en la mañana (8–12)',mediodia:'al mediodía (12–14)',tarde:'en la tarde (14–18)'};
  const go=(patch,v,b)=>()=>{Object.keys(FMAP).forEach(k=>F[k]='');Object.assign(F,patch);if(b)bandeja=b;view=v;limit=60;closeDrawer();update();window.scrollTo({top:0,behavior:'smooth'})};
  /* 1. Pendientes con personas esperando */
  const dev=calls.filter(c=>c.estado==='devolver_llamada');
  if(dev.length){const old=Math.max(...dev.map(c=>(NOW-c.hora_llamada)/36e5));
    out.push({sev:'alta',ic:'phone',t:'Llamadas por devolver',m:nf(dev.length),d:`Pendientes de todas las fechas. ${dev.length===1?'Una persona espera':nf(dev.length)+' personas esperan'} que el hospital les devuelva la llamada. La más antigua lleva ${old<1?'menos de una hora':Math.round(old)+' horas'}.`,a:'Abrir bandeja',fn:()=>{Object.keys(FMAP).forEach(k=>F[k]='');setPreset('todo');bandeja='devolver';view='llamadas';closeDrawer();update()}})}
  const pc=calls.filter(c=>c.estado==='por_confirmar'),pcOld=pc.filter(c=>NOW-c.hora_llamada>864e5);
  if(pc.length)out.push({sev:pcOld.length?'alta':'media',ic:'cal',t:'Citas sin confirmar',m:nf(pc.length),d:pcOld.length?`Pendientes de todas las fechas. ${nf(pcOld.length)} llevan más de 24 horas sin fecha, hora ni especialista. El paciente no sabe si tiene cita.`:`Solicitudes de hoy pendientes de fecha, hora y especialista.`,a:'Confirmar citas',fn:()=>{Object.keys(FMAP).forEach(k=>F[k]='');setPreset('todo');bandeja='por_confirmar';view='llamadas';closeDrawer();update()}});
  /* 2. Extensiones que no contestan en una franja */
  const inH=CUR.filter(c=>c.requiere_transferencia&&c.en_horario);const nc=[];
  EXTK.forEach(k=>['manana','mediodia','tarde'].forEach(f=>{const l=inH.filter(c=>c.extension_destino===k&&c.franja===f);if(l.length>=5){const n=l.filter(c=>c.resultado_transferencia==='no_contesto').length,pp=n/l.length*100;if(pp>=25)nc.push({k,f,n,t:l.length,pp})}}));
  nc.sort((a,b)=>b.pp-a.pp).slice(0,2).forEach(x=>out.push({sev:x.pp>=35?'alta':'media',ic:'alert',t:`${EXT[x.k]} no contesta ${fr[x.f]}`,m:Math.round(x.pp)+' %',d:`${x.n} de ${x.t} transferencias dentro del horario quedaron sin respuesta. Conviene cubrir esa franja con otra persona o desviar la extensión.`,a:'Ver extensión',fn:go({ext:x.k,franja:x.f},'extensiones')}));
  /* 3. Fuera de horario */
  if(s.req>=10&&s.pFh>=18){const fh=CUR.filter(c=>c.resultado_transferencia==='fuera_de_horario');
    const ext1=fh.filter(c=>{const w=c.hora_llamada.getDay(),h=c.hora_llamada.getHours();return !esFestivo(c.hora_llamada)&&((w>=1&&w<=5&&(h===18||h===7))||(w===6&&h>=13&&h<15))}).length;
    out.push({sev:'media',ic:'moon',t:'Necesitaban a una persona fuera de horario',m:nf(fh.length),d:`Son el ${Math.round(s.pFh)} % de las que requerían transferencia. Abrir las extensiones de 7 a 8 a. m. y de 6 a 7 p. m., y el sábado hasta las 3 p. m., habría atendido ${nf(ext1)} de ellas.`,a:'Ver llamadas',fn:go({res:'fuera_de_horario'},'llamadas','todas')})}
  /* 4. Tendencias frente al periodo anterior */
  if(PREV.length>=20){const d=s.pSolved-p.pSolved;
    if(d<=-3)out.push({sev:'media',ic:'down',t:'Bajó la resolución sin asesor',m:d.toFixed(1).replace('.',',')+' pp',d:`Pasó de ${Math.round(p.pSolved)} % a ${Math.round(s.pSolved)} %. Revise qué motivos crecieron y si hay preguntas nuevas que Lucía no sabe responder.`,a:'Ver por motivo',fn:()=>{view='resumen';serie='motivo';closeDrawer();update();setTimeout(()=>document.getElementById('evo').scrollIntoView({behavior:'smooth',block:'center'}),50)}});
    else if(d>=3)out.push({sev:'logro',ic:'up',t:'Subió la resolución sin asesor',m:'+'+d.toFixed(1).replace('.',',')+' pp',d:`Pasó de ${Math.round(p.pSolved)} % a ${Math.round(s.pSolved)} % frente al periodo anterior.`});
    const dn=s.pNc-p.pNc;if(dn>=4)out.push({sev:'media',ic:'down',t:'Más extensiones sin contestar',m:'+'+dn.toFixed(1).replace('.',',')+' pp',d:`El ${Math.round(s.pNc)} % de las transferencias no fue contestado (antes ${Math.round(p.pNc)} %).`,a:'Ver por extensión',fn:()=>{view='extensiones';closeDrawer();update()}})}
  const neg=CUR.filter(c=>c.sentimiento==='Negative');
  if(CUR.length>=20&&neg.length/CUR.length>=.12){const by={};neg.forEach(c=>{const k=c.resultado_transferencia==='no_aplica'?c.motivo_llamada:c.resultado_transferencia;by[k]=(by[k]||0)+1});const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
    out.push({sev:'media',ic:'heart',t:'Personas inconformes al colgar',m:Math.round(neg.length/CUR.length*100)+' %',d:`${nf(neg.length)} llamadas terminaron con sentimiento negativo. La causa más frecuente: ${(RES[top[0]]?RES[top[0]][0]:MOTIVOS[top[0]].n).toLowerCase()} (${top[1]}).`,a:'Ver llamadas',fn:go({res:RES[top[0]]?top[0]:'',mot:RES[top[0]]?'':top[0]},'llamadas','todas')})}
  /* 5. Oportunidades */
  const fg=CUR.filter(c=>c.tema_consulta==='fuera_guia');
  if(fg.length>=3){const by={};fg.forEach(c=>{const q=(c.pregunta||'').replace(/[¿?]/g,'');by[q]=(by[q]||0)+1});const top=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,3);
    out.push({sev:'opor',ic:'bulb',t:'Enseñarle a Lucía lo que más le preguntan',m:nf(fg.length),d:`Llamadas que pasaron a un asesor porque la respuesta no está en la guía. Las más repetidas: ${top.map(([q,n])=>`«${q}» (${n})`).join(', ')}. Con esas respuestas, Lucía las resolvería sola.`,a:'Ver llamadas',fn:go({mot:'informacion_basica',res:'req'},'llamadas','todas')})}
  if(s.citas>=10&&s.sinOrden/s.citas>=.08)out.push({sev:'opor',ic:'doc',t:'Citas que llegan sin orden médica',m:pct(s.sinOrden,s.citas)+' %',d:`${nf(s.sinOrden)} de ${nf(s.citas)} solicitudes no tienen la orden. Enviar de inmediato la plantilla «Falta la orden» evita que el asesor tenga que llamar.`,a:'Ver solicitudes',fn:go({mot:'cita_nueva'},'llamadas','todas')});
  if(s.solved){const h=s.durSolved/3600;out.push({sev:'logro',ic:'check',t:'Atención que no ocupó al equipo',m:h>=10?nf(Math.round(h))+' h':h.toFixed(1).replace('.',',')+' h',d:`Lucía resolvió ${nf(s.solved)} llamadas sin pasar a una persona, por ${cop(s.costSolved)} (${cop(s.costPerSolved)} cada una).`})}
  if(CUR.length>=30){const m={};CUR.forEach(c=>{const k=c.hora_llamada.getDay()+'-'+c.hora_llamada.getHours();m[k]=(m[k]||0)+1});const [k,v]=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];const [w,h]=k.split('-').map(Number);
    out.push({sev:'opor',ic:'peak',t:'Hora pico de llamadas',m:DOW[w]+' '+h+' h',d:`Los ${DOWL[w]} de ${h} a ${h+1} es la hora con más llamadas (${v} en el periodo). Es la hora para tener todas las extensiones cubiertas.`,a:'Ver mapa',fn:()=>{view='resumen';closeDrawer();update();setTimeout(()=>document.getElementById('heat').scrollIntoView({behavior:'smooth',block:'center'}),50)}})}
  if(s.urg)out.push({sev:'media',ic:'alert',t:'Urgencias remitidas',m:nf(s.urg),d:`Lucía indicó ir a urgencias o llamar al 123. ${pct(CUR.filter(c=>c.urgencia_detectada&&!c.en_horario).length,s.urg)} % llegaron fuera del horario de oficina.`,a:'Ver llamadas',fn:go({mot:'urgencia'},'llamadas','todas')});
  const ord={alta:0,media:1,opor:2,logro:3};return out.sort((a,b)=>ord[a.sev]-ord[b.sev]);
}
const SEV={alta:['Alarma','bad'],media:['Atención','wa'],opor:['Oportunidad','ac'],logro:['Logro','ok']};
const card=(x,i,compact)=>`<article class="ins ${x.sev}${compact?' cmp':''}"><div class="ih">${icon(x.ic)}<span class="tag ${SEV[x.sev][1]}">${SEV[x.sev][0]}</span></div><div class="im">${x.m}</div><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p>${x.a?`<button type="button" class="ia" data-i="${i}">${x.a} →</button>`:''}</article>`;
function renderDecide(){
  INS=insights();const cnt=k=>INS.filter(x=>x.sev===k).length;
  $('#decide').innerHTML=`<div class="dhd"><div><span class="lbl">Para decidir · ${F.preset==='hoy'?'hoy':fmtD(F.from)+' – '+fmtD(F.to)}</span><h2>Qué requiere atención</h2></div><div class="sem"><span class="s bad"><b>${cnt('alta')}</b> alarmas</span><span class="s wa"><b>${cnt('media')}</b> por revisar</span><span class="s ac"><b>${cnt('opor')}</b> oportunidades</span><span class="s ok"><b>${cnt('logro')}</b> logros</span></div></div><div class="insg">${INS.map((x,i)=>card(x,i)).join('')||'<div class="empty">Sin alertas con estos filtros.</div>'}</div>`;
  $$('#decide .ia').forEach(b=>b.onclick=()=>INS[+b.dataset.i].fn());
  badge();
}
function badge(){const n=(INS.length?INS:insights()).filter(x=>x.sev==='alta'||x.sev==='media').length;const b=$('#fabAlertN');b.textContent=n;b.hidden=!n;
  const af=Object.keys(FMAP).filter(k=>F[k]).length;const fb=$('#fabFiltN');fb.textContent=af;fb.hidden=!af}
function openDrawer(){if(!INS.length)INS=insights();const d=$('#drawer');$('#drawerBody').innerHTML=INS.map((x,i)=>card(x,i,1)).join('');$$('#drawerBody .ia').forEach(b=>b.onclick=()=>INS[+b.dataset.i].fn());d.hidden=false;$('#scrim').hidden=false;requestAnimationFrame(()=>d.classList.add('open'));$('#drawerClose').focus()}
function closeDrawer(){const d=$('#drawer');if(d.hidden)return;d.classList.remove('open');$('#scrim').hidden=true;setTimeout(()=>d.hidden=true,200)}

/* Mini tendencia diaria para las tarjetas */
function spark(fn){if(ndays()<3)return '';const bk=buckets('dia',F.from,F.to),idx=Object.fromEntries(bk.map((b,i)=>[b.k,i])),g=bk.map(()=>[]);CUR.forEach(c=>{const i=idx[iso(day0(c.hora_llamada))];if(i!=null)g[i].push(c)});
  const v=g.map(l=>l.length?fn(S(l)):null),vv=v.filter(x=>x!=null);if(vv.length<2)return '';const mn=Math.min(...vv),mx=Math.max(...vv),W=120,H=30,n=v.length;
  const pts=v.map((x,i)=>x==null?null:[i/(n-1)*W,H-2-(mx===mn?.5:(x-mn)/(mx-mn))*(H-4)]).filter(Boolean);
  const d='M'+pts.map(p=>p.map(z=>z.toFixed(1)).join(',')).join('L');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${W},${H}L0,${H}Z" class="sa"/><path d="${d}" class="sl"/></svg>`}

/* ===== Render general ===== */
function update(){aplicar();syncUI();chipsUI();
  if(view==='resumen')vResumen();else if(view==='extensiones')vExt();else if(view==='comparar')vCmp();else if(view==='llamadas')vCalls();else vHook();
  if(view!=='resumen'){INS=insights();badge()}
  $('#lastHook').textContent=fmtT(calls[0].hora_llamada);
  try{history.replaceState(null,'','#'+view)}catch(e){}}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,2600)}

fillSelects();
const h=location.hash.slice(1);if(['resumen','extensiones','comparar','llamadas','webhook'].includes(h))view=h;
setPreset('30d');
$$('#presets button').forEach(b=>b.onclick=()=>{setPreset(b.dataset.p);update()});
$('#fDesde').onchange=e=>{if(!e.target.value)return;const[y,m,d]=e.target.value.split('-').map(Number);F.from=new Date(y,m-1,d);if(F.from>F.to)F.to=new Date(F.from);F.preset='';gran=null;update()};
$('#fHasta').onchange=e=>{if(!e.target.value)return;const[y,m,d]=e.target.value.split('-').map(Number);F.to=new Date(y,m-1,d);if(F.to<F.from)F.from=new Date(F.to);F.preset='';gran=null;update()};
Object.entries(FMAP).forEach(([k,id])=>$(id).addEventListener(k==='q'?'input':'change',e=>{F[k]=e.target.value;limit=60;update()}));
$('#clear').onclick=()=>{Object.keys(FMAP).forEach(k=>F[k]='');setPreset('30d');update()};
$$('.views [data-v]').forEach(b=>b.onclick=()=>{view=b.dataset.v;update()});
$$('#gran button').forEach(b=>b.onclick=()=>{gran=b.dataset.g;vResumen()});
$$('#serie button').forEach(b=>b.onclick=()=>{serie=b.dataset.s;vResumen()});
$$('#cmpGran button').forEach(b=>b.onclick=()=>{cmpGran=b.dataset.g;vCmp()});
$$('#naBy button').forEach(b=>b.onclick=()=>{naBy=b.dataset.n;vExt()});
addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(v!==view&&['resumen','extensiones','comparar','llamadas','webhook'].includes(v)){view=v;update()}});
 $('#fabAlert').onclick=openDrawer;$('#drawerClose').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;
addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
const openF=o=>{const f=document.querySelector('.fbar');f.classList.toggle('open',o);$('#fMore').setAttribute('aria-expanded',o);$('#fMore').textContent=o?'Ocultar filtros':'Más filtros'};
$('#fMore').onclick=()=>openF(!document.querySelector('.fbar').classList.contains('open'));
$('#fabFilt').onclick=()=>{openF(true);document.querySelector('.fbar').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#fExt').focus({preventScroll:true}),400)};
$('#fabTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('#fabSim').onclick=()=>$('#simulate').click();
function setTheme(t){document.documentElement.setAttribute('data-theme',t);try{localStorage.setItem('da-tema',t)}catch(e){}$('#fabTheme').setAttribute('aria-label',t==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro');update()}
$('#fabTheme').onclick=()=>{const cur=document.documentElement.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');setTheme(cur==='dark'?'light':'dark')};
addEventListener('scroll',()=>{$('#fabTop').classList.toggle('show',scrollY>600)},{passive:true});
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(update,200)});

const POOL=[
 {nombre_completo:'Yeison Andrés Moreno',cedula_paciente:'1.058.977.120',telefono_contacto:'317 *** 5530',motivo_llamada:'cita_nueva',especialidad:'Ortopedia',tipo_cita:'primera_vez',eps:'Nueva EPS',tiene_orden:true,resumen:'Pide ortopedia por dolor de rodilla; tiene orden del médico general.'},
 {nombre_completo:'Blanca Nelly Ospina',cedula_paciente:'24.551.300',telefono_contacto:'312 *** 7718',motivo_llamada:'resultados_autorizaciones',eps:'Salud Total',requiere_transferencia:true,extension_destino:'laboratorio',pregunta:'¿Ya están los resultados del parcial de orina?',resumen:'Pregunta por resultados de laboratorio. Llamó fuera del horario de las extensiones.'},
 {nombre_completo:'Edwin Camilo Arias',cedula_paciente:'1.060.411.087',telefono_contacto:'301 *** 9944',motivo_llamada:'informacion_basica',consulta_basica:true,tema_consulta:'requisitos',pregunta:'¿Qué necesito llevar para la cita?',respuesta:'Llegue quince minutos antes con el documento del paciente y, si aplica, la orden médica o la autorización.',resumen:'Pregunta qué llevar a la cita. Resuelto por Lucía.'}
];
let pi=0,sim=0;
$('#simulate').onclick=()=>{const t=new Date(+NOW+(++sim)*7*60000);const c=finish({...base,hora_llamada:t,...POOL[pi++%POOL.length],id:CRM.nextId()});calls.unshift(c);
  if(!enRango(c,F.from,F.to)){setPreset('hoy')}Object.keys(FMAP).forEach(k=>F[k]='');selectCall(c.id);bandeja='todas';view='llamadas';limit=60;toast('Llegó una llamada nueva por el webhook (simulado)');update()};
update();
})();
