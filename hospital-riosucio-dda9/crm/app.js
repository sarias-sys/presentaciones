(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(a,b)=>b?Math.round(a/b*100):0;
const {MOTIVOS,EXT,RES,ESTADO,enHorario,PREP,TPL,finish,base}=CRM;let calls=CRM.calls;
let filter='todas',sel=calls[0].id,tplSel='confirmacion',tab='datos';
const fmtT=d=>d.toLocaleDateString('es-CO',{weekday:'short'}).replace('.','')+' '+d.toLocaleTimeString('es-CO',{hour:'numeric',minute:'2-digit'});
const first=n=>String(n).split(' ')[0];

function renderKpis(){
  const t=calls.length,b=calls.filter(c=>c.consulta_basica).length,s=calls.filter(c=>c.resuelta_por_asistente).length;
  const req=calls.filter(c=>c.requiere_transferencia),ok=req.filter(c=>c.resultado_transferencia==='exitosa'),nc=req.filter(c=>c.resultado_transferencia==='no_contesto'),fh=req.filter(c=>c.resultado_transferencia==='fuera_de_horario');
  $('#kTotal').textContent=t;$('#kBasic').textContent=pct(b,t)+' %';$('#kBasicSub').textContent=b+' de '+t+' solo pedían información';
  $('#kSolved').textContent=pct(s,t)+' %';$('#kSolvedSub').textContent=s+' de '+t+' sin pasar a un asesor';
  $('#kPend').textContent=calls.filter(c=>c.estado==='por_confirmar').length;
  $('#kReq').textContent=req.length;$('#kReqSub').textContent=pct(req.length,t)+' % de las llamadas';
  $('#kOk').textContent=ok.length;$('#kOkSub').textContent=pct(ok.length,req.length)+' % de las que la requerían';
  $('#kNc').textContent=nc.length;$('#kNcSub').textContent=pct(nc.length,req.length)+' % · la extensión no contestó';
  $('#kFh').textContent=fh.length;$('#kFhSub').textContent=pct(fh.length,req.length)+' % · llamaron fuera de horario';
  /* barra de transferencias */
  const seg=(n,cls,l)=>n?`<i class="${cls}" style="flex:${n}" title="${l}: ${n}"><span>${pct(n,req.length)} %</span></i>`:'';
  $('#tbar').innerHTML=seg(ok.length,'s-ok','Con éxito')+seg(nc.length,'s-nc','No contestó')+seg(fh.length,'s-fh','Fuera de horario');
  const byExt={};req.forEach(c=>{const e=byExt[c.extension_destino]||(byExt[c.extension_destino]={t:0,ok:0,nc:0,fh:0});e.t++;e[{exitosa:'ok',no_contesto:'nc',fuera_de_horario:'fh'}[c.resultado_transferencia]]++});
  $('#text').innerHTML=`<table><thead><tr><th>Extensión</th><th>Requerían</th><th>Con éxito</th><th>No contestó</th><th>Fuera de horario</th></tr></thead><tbody>${Object.entries(byExt).map(([k,e])=>`<tr><td>${EXT[k]}</td><td>${e.t}</td><td>${e.ok}</td><td>${e.nc}</td><td>${e.fh}</td></tr>`).join('')}</tbody></table>`;
}
function renderTypes(){
  const el=$('#types');el.innerHTML='';
  const head=t=>{const h=document.createElement('div');h.className='lbl tg';h.textContent=t;el.appendChild(h)};
  const mk=(key,name,count,color)=>{const b=document.createElement('button');b.type='button';b.className='type'+(filter===key?' on':'');b.innerHTML=`<span>${color?`<i class="dot" style="background:${color}"></i>`:''}${esc(name)}</span><span class="c">${count}</span>`;b.onclick=()=>{filter=key;render()};el.appendChild(b)};
  mk('todas','Todas',calls.length);
  head('Seguimiento');
  mk('por_confirmar','Citas por confirmar',calls.filter(c=>c.estado==='por_confirmar').length,'var(--warn)');
  mk('devolver','Devolver llamada',calls.filter(c=>c.estado==='devolver_llamada').length,'var(--bad)');
  head('Transferencias');
  mk('t_req','Requerían transferencia',calls.filter(c=>c.requiere_transferencia).length,'var(--ink-3)');
  mk('t_ok','Transferidas con éxito',calls.filter(c=>c.resultado_transferencia==='exitosa').length,'var(--good)');
  mk('t_nc','No contestó la extensión',calls.filter(c=>c.resultado_transferencia==='no_contesto').length,'var(--bad)');
  mk('t_fh','Fuera de horario',calls.filter(c=>c.resultado_transferencia==='fuera_de_horario').length,'var(--warn)');
  mk('t_no','Resueltas sin transferir',calls.filter(c=>!c.requiere_transferencia).length,'var(--accent)');
  head('Motivo');
  Object.entries(MOTIVOS).forEach(([k,v])=>mk(k,v.n,calls.filter(c=>c.motivo_llamada===k).length,v.c));
}
const FILT={todas:()=>true,por_confirmar:c=>c.estado==='por_confirmar',devolver:c=>c.estado==='devolver_llamada',t_req:c=>c.requiere_transferencia,t_ok:c=>c.resultado_transferencia==='exitosa',t_nc:c=>c.resultado_transferencia==='no_contesto',t_fh:c=>c.resultado_transferencia==='fuera_de_horario',t_no:c=>!c.requiere_transferencia};
const TITLES={todas:'Todas las llamadas',por_confirmar:'Citas por confirmar',devolver:'Devolver llamada',t_req:'Requerían transferencia',t_ok:'Transferidas con éxito',t_nc:'No contestó la extensión',t_fh:'Fuera de horario',t_no:'Resueltas sin transferir'};
function filtered(){
  const q=$('#q').value.trim().toLowerCase(),e=$('#fEsp').value,st=$('#fEst').value,f=FILT[filter]||(c=>c.motivo_llamada===filter);
  return calls.filter(c=>f(c)&&(!e||c.especialidad===e)&&(!st||c.estado===st)&&(!q||[c.nombre_completo,c.cedula_paciente,c.telefono_contacto].join(' ').toLowerCase().includes(q)));
}
function tagsFor(c){
  const m=MOTIVOS[c.motivo_llamada];let h=`<span class="tag" style="color:${m.c}">${m.n}</span>`;
  if(c.urgencia_detectada)h+='<span class="tag bad">Urgencia</span>';
  else if(c.requiere_transferencia){const r=RES[c.resultado_transferencia];h+=`<span class="tag ${r[1]}">${c.resultado_transferencia==='exitosa'?'→ '+EXT[c.extension_destino]:r[0]}</span>`}
  else h+='<span class="tag ok">Resuelta por Lucía</span>';
  if(['por_confirmar','confirmacion_enviada','recordatorio_enviado','devolver_llamada'].includes(c.estado)){const s=ESTADO[c.estado];h+=`<span class="tag ${s[1]}">${s[0]}</span>`}
  return h;
}
function renderList(){
  const rows=filtered();const el=$('#list');
  $('#listTitle').textContent=TITLES[filter]||MOTIVOS[filter].n;
  $('#listCount').textContent=rows.length+(rows.length===1?' llamada':' llamadas');
  if(!rows.length){el.innerHTML='<div class="empty">No hay llamadas con estos filtros.</div>';return}
  el.innerHTML='';
  rows.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='row'+(c.id===sel?' on':'');
    b.innerHTML=`<span class="t">${fmtT(c.hora_llamada)}</span><div><div class="n">${esc(c.nombre_completo)}</div><div class="s">${esc(c.especialidad?c.especialidad+' · ':'')}${esc(c.resumen)}</div></div><div class="tags">${tagsFor(c)}</div>`;
    b.onclick=()=>{sel=c.id;tplSel=c.estado==='devolver_llamada'?'devolver':c.estado==='confirmacion_enviada'?'recordatorio':(c.tiene_orden===false?'orden':'confirmacion');render()};el.appendChild(b)});
}
const yn=v=>v===true?'Sí':v===false?'No':'—';
function renderDetail(){
  const c=calls.find(x=>x.id===sel);const el=$('#detail');
  if(!c){el.innerHTML='<div class="empty">Seleccione una llamada.</div>';return}
  const isCita=['cita_nueva','gestion_cita'].includes(c.motivo_llamada)&&c.especialidad;
  const needsMsg=isCita||c.estado==='devolver_llamada';
  const tpls=Object.entries(TPL).filter(([k])=>c.estado==='devolver_llamada'?k==='devolver'||(isCita&&k!=='devolver'):k!=='devolver');
  if(!tpls.find(([k])=>k===tplSel)&&tpls.length)tplSel=tpls[0][0];
  const r={...c,nombre1:first(c.nombre_completo),motivoTxt:MOTIVOS[c.motivo_llamada].n.toLowerCase()};
  const payload={evento:'llamada.finalizada',asistente:'DEMO ESE RIOSUCIO',id_llamada:c.id,fecha:c.hora_llamada.toISOString(),duracion_seg:c.transcripcion.length*9,datos:{motivo_llamada:c.motivo_llamada,consulta_basica:c.consulta_basica,resuelta_por_asistente:c.resuelta_por_asistente,requiere_transferencia:c.requiere_transferencia,resultado_transferencia:c.resultado_transferencia,transferida:c.transferida,extension_destino:c.extension_destino,especialidad:c.especialidad||null,tipo_cita:c.tipo_cita||null,eps:c.eps||null,tiene_orden:c.tiene_orden,cedula_paciente:c.cedula_paciente,nombre_completo:c.nombre_completo,telefono_contacto:c.telefono_contacto,urgencia_detectada:c.urgencia_detectada,resumen:c.resumen},transcripcion:c.transcripcion.map(([q,t])=>({rol:q,texto:t}))};
  const rt=RES[c.resultado_transferencia];
  el.innerHTML=`
  <div class="dsec">
    <div class="dh"><div><span class="lbl">${c.id} · ${fmtT(c.hora_llamada)} · ${enHorario(c.hora_llamada)?'en horario':'fuera de horario'}</span><h3>${esc(c.nombre_completo)}</h3></div><div class="tags">${tagsFor(c)}</div></div>
    <p class="resumen">${esc(c.resumen)}</p>
    <div class="tabs" role="tablist"><button type="button" role="tab" data-t="datos" aria-selected="${tab==='datos'}">Datos post-llamada</button><button type="button" role="tab" data-t="trans" aria-selected="${tab==='trans'}">Transcripción</button></div>
  </div>
  ${tab==='datos'?`
  <div class="dsec">
    <div class="fields">
      <div class="f"><span>CÉDULA</span><b>${esc(c.cedula_paciente)}</b></div>
      <div class="f"><span>TELÉFONO</span><b>${esc(c.telefono_contacto)}</b></div>
      <div class="f"><span>ESPECIALIDAD</span><b>${esc(c.especialidad||'—')}</b></div>
      <div class="f"><span>TIPO DE CITA</span><b>${c.tipo_cita==='control'?'Control':c.tipo_cita==='primera_vez'?'Primera vez':'—'}</b></div>
      <div class="f"><span>EPS</span><b>${esc(c.eps||'—')}</b></div>
      <div class="f"><span>TIENE ORDEN</span><b>${yn(c.tiene_orden)}</b></div>
      <div class="f"><span>CONSULTA BÁSICA</span><b>${yn(c.consulta_basica)}</b></div>
      <div class="f"><span>REQUERÍA TRANSFERENCIA</span><b>${yn(c.requiere_transferencia)}${c.requiere_transferencia?' · '+EXT[c.extension_destino]:''}</b></div>
      <div class="f" style="grid-column:1/-1"><span>RESULTADO DE LA TRANSFERENCIA</span><b>${rt[0]}</b></div>
    </div>
  </div>`:`
  <div class="dsec"><div class="tx">${c.transcripcion.map(([q,t])=>`<p class="${q==='Lucía'?'ai':q==='Sistema'?'sys':'pt'}"><b>${q}</b>${esc(t)}</p>`).join('')}</div><p class="foot" style="margin:0">Transcripción generada por Flow al terminar la llamada; la grabación queda en la plataforma.</p></div>`}
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
    <div class="log">${[{t:c.hora_llamada,txt:'Llamada atendida por Lucía; llegaron los datos post-llamada'}].concat(c.envios).map(e=>`<div><span>${fmtT(e.t)}</span><p style="margin:0">${esc(e.txt)}</p></div>`).join('')}</div>
    <details><summary>Ver lo que envió el webhook</summary><pre>${esc(JSON.stringify(payload,null,2))}</pre></details>
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
    toast(`Plantilla «${TPL[tplSel].n}» lista para ${first(c.nombre_completo)} (simulado)`);render()};
  const cl=$('#close');if(cl)cl.onclick=()=>{c.estado='cerrada';c.envios.push({t:new Date(),txt:'Caso cerrado'});toast('Caso cerrado');render()};
}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,2600)}
function render(){renderKpis();renderTypes();renderList();renderDetail();$('#lastHook').textContent=fmtT(calls[0].hora_llamada)}
const esps=[...new Set(calls.map(c=>c.especialidad).filter(Boolean).concat(Object.keys(PREP)))].sort();
esps.forEach(e=>{const o=document.createElement('option');o.value=e;o.textContent=e;$('#fEsp').appendChild(o)});
['q','fEsp','fEst'].forEach(id=>$('#'+id).addEventListener('input',renderList));

const POOL=[
 {nombre_completo:'Yeison Andrés Moreno',cedula_paciente:'1.058.977.120',telefono_contacto:'317 *** 5530',motivo_llamada:'cita_nueva',especialidad:'Ortopedia',tipo_cita:'primera_vez',eps:'Nueva EPS',tiene_orden:true,resumen:'Pide ortopedia por dolor de rodilla; tiene orden del médico general.'},
 {nombre_completo:'Blanca Nelly Ospina',cedula_paciente:'24.551.300',telefono_contacto:'312 *** 7718',motivo_llamada:'resultados_autorizaciones',eps:'Salud Total',requiere_transferencia:true,extension_destino:'laboratorio',resultado_transferencia:'no_contesto',pregunta:'¿Ya están los resultados del parcial de orina?',resumen:'Pregunta por resultados; la extensión de laboratorio no contestó.'},
 {nombre_completo:'Edwin Camilo Arias',cedula_paciente:'1.060.411.087',telefono_contacto:'301 *** 9944',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿Qué necesito llevar para la cita?',respuesta:'Llegue quince minutos antes con el documento del paciente y, si aplica, la orden médica o la autorización.',resumen:'Pregunta qué llevar a la cita. Resuelto.'}
];
let pi=0;
$('#simulate').onclick=()=>{const c=finish({...base,hora_llamada:new Date(),...POOL[pi++%POOL.length],id:CRM.nextId()});calls.unshift(c);sel=c.id;filter='todas';tab='datos';tplSel=c.estado==='devolver_llamada'?'devolver':(c.tiene_orden===false?'orden':'confirmacion');toast('Llegó una llamada nueva desde el webhook (simulado)');render()};
render();
})();
