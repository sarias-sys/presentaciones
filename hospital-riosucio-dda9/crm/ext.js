(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const {EXT,RES,MOTIVOS,enHorario}=CRM;const calls=CRM.calls;
const KEYS=['citas','siau','laboratorio','facturacion','informacion'];
let sel='todas';
const req=()=>calls.filter(c=>c.requiere_transferencia&&(sel==='todas'||c.extension_destino===sel));
const stats=list=>({t:list.length,ok:list.filter(c=>c.resultado_transferencia==='exitosa').length,nc:list.filter(c=>c.resultado_transferencia==='no_contesto').length,fh:list.filter(c=>c.resultado_transferencia==='fuera_de_horario').length});
const fmtT=d=>d.toLocaleDateString('es-CO',{weekday:'short'}).replace('.','')+' '+d.toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'});
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function chips(){const el=$('#chips');el.innerHTML='';
  [['todas','Todas las extensiones']].concat(KEYS.map(k=>[k,EXT[k]])).forEach(([k,n])=>{const b=document.createElement('button');b.type='button';b.className='tpl';b.setAttribute('aria-pressed',k===sel);
    const cnt=calls.filter(c=>c.requiere_transferencia&&(k==='todas'||c.extension_destino===k)).length;b.textContent=n+' · '+cnt;b.onclick=()=>{sel=k;render()};el.appendChild(b)});}
function kpis(){const all=calls.filter(c=>c.requiere_transferencia),s=stats(req());
  $('#eName').textContent=sel==='todas'?'Todas las extensiones':'Extensión de '+EXT[sel];
  $('#kReq').textContent=s.t;$('#kReqSub').textContent=sel==='todas'?pct(s.t,calls.length)+' % de todas las llamadas':pct(s.t,all.length)+' % de todas las transferencias';
  $('#kOk').textContent=s.ok;$('#kOkSub').textContent=pct(s.ok,s.t)+' % tasa de éxito';
  $('#kNc').textContent=s.nc;$('#kNcSub').textContent=pct(s.nc,s.t)+' % · la extensión no contestó';
  $('#kFh').textContent=s.fh;$('#kFhSub').textContent=pct(s.fh,s.t)+' % · llamaron fuera de horario';}
function table(){const rows=KEYS.map(k=>{const s=stats(calls.filter(c=>c.requiere_transferencia&&c.extension_destino===k));return [k,s]});
  const tot=stats(calls.filter(c=>c.requiere_transferencia));
  const tr=(k,n,s,b)=>`<tr${k===sel?' class="on"':''}${b?' style="font-weight:600"':''}><td>${n}</td><td>${s.t}</td><td>${s.ok} <span class="pc">${pct(s.ok,s.t)} %</span></td><td>${s.nc} <span class="pc">${pct(s.nc,s.t)} %</span></td><td>${s.fh} <span class="pc">${pct(s.fh,s.t)} %</span></td><td><div class="mini">${s.t?`<i class="s-ok" style="flex:${s.ok}"></i><i class="s-nc" style="flex:${s.nc}"></i><i class="s-fh" style="flex:${s.fh}"></i>`:''}</div></td></tr>`;
  $('#cmp').innerHTML=`<table><thead><tr><th>Extensión</th><th>Requerían</th><th>Con éxito</th><th>No contestó</th><th>Fuera de horario</th><th>Reparto</th></tr></thead><tbody>${rows.map(([k,s])=>tr(k,EXT[k],s)).join('')}${tr('','Total',tot,true)}</tbody></table>`;}
function chart(){
  const list=req(),W=760,H=230,L=36,B=34,T=14,R=8,hrs=[...Array(24).keys()];
  const by=hrs.map(h=>{const l=list.filter(c=>c.hora_llamada.getHours()===h);return stats(l)});
  const max=Math.max(2,...by.map(s=>s.t));const bw=(W-L-R)/24;const y=v=>T+(H-T-B)*(1-v/max);
  let s=`<rect x="${L+8*bw}" y="${T}" width="${10*bw}" height="${H-T-B}" fill="${css('--good-soft')}" opacity=".55"/><text x="${L+13*bw}" y="${T+12}" text-anchor="middle" font-size="11" fill="${css('--ink-2')}" font-family="Geist Mono, monospace">horario de extensiones (L–V 8–18)</text>`;
  for(let v=0;v<=max;v++){s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="${css('--line')}"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="${css('--ink-3')}">${v}</text>`}
  by.forEach((st,h)=>{const x=L+h*bw+bw*.18,w=bw*.64;let base=H-B;
    [['ok','--good'],['nc','--bad'],['fh','--warn']].forEach(([k,c])=>{if(!st[k])return;const hh=(H-T-B)*(st[k]/max);base-=hh;s+=`<rect x="${x}" y="${base}" width="${w}" height="${hh}" fill="${css(c)}"><title>${h}:00 · ${st[k]}</title></rect>`});
    if(h%3===0)s+=`<text x="${L+h*bw+bw/2}" y="${H-12}" text-anchor="middle" font-size="11" fill="${css('--ink-2')}">${h} h</text>`});
  $('#chart').innerHTML=s;}
function list(){const l=req().sort((a,b)=>b.hora_llamada-a.hora_llamada);const el=$('#elist');
  if(!l.length){el.innerHTML='<div class="empty">Ninguna llamada requirió esta extensión.</div>';return}
  el.innerHTML=l.map(c=>{const r=RES[c.resultado_transferencia];return `<div class="row" style="cursor:default"><span class="t">${fmtT(c.hora_llamada)}</span><div><div class="n">${esc(c.nombre_completo)}</div><div class="s">${esc(c.resumen)}</div></div><div class="tags"><span class="tag">${EXT[c.extension_destino]}</span><span class="tag ${r[1]}">${r[0]}</span></div></div>`}).join('');
  $('#lcount').textContent=l.length+(l.length===1?' llamada':' llamadas');}
function render(){chips();kpis();table();chart();list()}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',chart)}catch(e){}
render();
})();
