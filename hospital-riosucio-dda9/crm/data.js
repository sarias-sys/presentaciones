/* CRM de llamadas del asistente de voz · Hospital San Juan de Dios de Riosucio.
   Datos de EJEMPLO generados con semilla fija (agosto a noviembre de 2026).
   En producción, cada registro llega por el «Reenvío a webhook externo» de Flow cuando
   termina la llamada: datos de la llamada (id, inicio, fin, duración, número, motivo de
   desconexión, grabación, transcripción) + análisis post-llamada (resumen, sentimiento,
   llamada exitosa y los campos personalizados que configuramos en el asistente). */
window.CRM=(function(){

/* Opciones idénticas al selector «motivo_llamada» configurado en Flow. */
const MOTIVOS={
  cita_nueva:{n:'Cita nueva',c:'oklch(0.58 0.14 350)'},
  gestion_cita:{n:'Gestión de cita',c:'oklch(0.55 0.13 300)'},
  informacion_basica:{n:'Información básica',c:'oklch(0.58 0.12 255)'},
  resultados_autorizaciones:{n:'Resultados y autorizaciones',c:'oklch(0.62 0.1 200)'},
  pqrs:{n:'PQRS',c:'oklch(0.66 0.13 70)'},
  urgencia:{n:'Urgencia',c:'oklch(0.58 0.19 25)'},
  otro:{n:'Otro',c:'oklch(0.62 0.02 270)'}
};
const EXT={citas:'Citas',siau:'SIAU',laboratorio:'Laboratorio',facturacion:'Facturación',informacion:'Información',ninguna:'—'};
const EXTNUM={informacion:100,citas:101,siau:102,laboratorio:103,facturacion:104};
const RES={exitosa:['Transferida con éxito','ok'],no_contesto:['No contestó la extensión','bad'],fuera_de_horario:['Fuera de horario','wa'],no_aplica:['No requería transferencia','']};
const ESTADO={por_confirmar:['Cita por confirmar','wa'],confirmacion_enviada:['Confirmación enviada','ac'],recordatorio_enviado:['Recordatorio enviado','ok'],cerrada:['Cerrada',''],devolver_llamada:['Devolver llamada','bad']};
const TEMAS={horarios:'Horarios',ubicacion:'Ubicación y teléfonos',eps:'EPS con convenio',requisitos:'Requisitos para la cita',servicios:'Servicios',fuera_guia:'No está en la guía'};
const FRANJAS=[['madrugada','Madrugada',0,6],['temprano','Temprano',6,8],['manana','Mañana',8,12],['mediodia','Mediodía',12,14],['tarde','Tarde',14,18],['noche','Noche',18,24]];
const franjaDe=d=>{const h=d.getHours();return FRANJAS.find(f=>h>=f[2]&&h<f[3])[0]};

/* Festivos de Colombia en el periodo de ejemplo: las extensiones no atienden. */
const FESTIVOS=['2026-08-07','2026-08-17','2026-10-12','2026-11-02','2026-11-16','2026-12-08','2026-12-25'];
const dkey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const esFestivo=d=>FESTIVOS.includes(dkey(d));
/* Horario de las extensiones: lunes a viernes 8 a. m. a 6 p. m.; sábado 8 a. m. a 1 p. m.; no domingos ni festivos. */
function enHorario(d){if(esFestivo(d))return false;const w=d.getDay(),h=d.getHours()+d.getMinutes()/60;if(w>=1&&w<=5)return h>=8&&h<18;if(w===6)return h>=8&&h<13;return false}
/* «Ahora» fijo para que la demo sea siempre igual. */
const NOW=new Date(2026,10,5,17,40);

const PREP={
  'Medicina general':'Traiga su documento y, si tiene, los exámenes recientes.',
  'Pediatría':'Traiga el documento del niño o la niña y el carné de vacunas.',
  'Odontología':'Traiga su documento. Si tiene dolor o inflamación, avísenos antes de la cita.',
  'Ginecología':'Traiga su documento, la orden médica y los resultados de citología o ecografías anteriores.',
  'Medicina interna':'Traiga su documento, la orden médica, la fórmula actual y los exámenes recientes.',
  'Ortopedia':'Traiga su documento, la orden médica y las radiografías o estudios que tenga.',
  'Laboratorio':'Venga en ayunas de 8 a 12 horas, con su documento y la orden médica.',
  'Ecografía':'Según el tipo de ecografía puede requerir vejiga llena o ayuno; se lo indicamos al confirmar.'
};
const TPL={
  confirmacion:{n:'Confirmar cita',body:r=>`Hola, ${r.nombre1}. Le escribimos del Hospital San Juan de Dios de Riosucio.\nSu cita de ${r.especialidad.toLowerCase()} (${r.tipo_cita==='control'?'control':'primera vez'}) quedó asignada así:\nFecha: ${r.fecha||'[fecha]'}\nHora: ${r.hora||'[hora]'}\nEspecialista: ${r.especialista||'[especialista]'}\n${PREP[r.especialidad]||'Traiga su documento.'}\nPor favor llegue 15 minutos antes.\n¿Confirma su asistencia? Responda SÍ o NO.`},
  recordatorio:{n:'Recordatorio',body:r=>`Hola, ${r.nombre1}. Le recordamos su cita de ${r.especialidad.toLowerCase()} mañana a las ${r.hora||'[hora]'} con ${r.especialista||'[especialista]'}.\n${PREP[r.especialidad]||'Traiga su documento.'}\nSi no puede asistir, responda CANCELAR para liberar el espacio.`},
  orden:{n:'Falta la orden',body:r=>`Hola, ${r.nombre1}. Recibimos su solicitud de cita de ${r.especialidad.toLowerCase()}.\nPara asignarla necesitamos la orden médica o la autorización de ${r.eps}. Puede enviarla por este chat como foto o PDF.`},
  reprogramar:{n:'Reprogramar',body:r=>`Hola, ${r.nombre1}. Necesitamos mover su cita de ${r.especialidad.toLowerCase()}.\nTenemos disponible: ${r.fecha||'[fecha]'} a las ${r.hora||'[hora]'}.\n¿Le sirve? Responda SÍ o propóngame otro horario.`},
  devolver:{n:'Le devolvemos la llamada',body:r=>`Hola, ${r.nombre1}. Le escribimos del Hospital San Juan de Dios de Riosucio por su llamada${r.motivoTxt?' sobre '+r.motivoTxt:''}.\nNo pudimos comunicarlo con el área en ese momento. ¿Le parece bien que lo llamemos hoy, o prefiere que le ayudemos por este chat?`}
};

/* Transcripción de ejemplo, armada con los datos de la llamada. En producción llega completa en el webhook (campo transcript). */
function transcript(c){
  const L=[['Lucía','Hola, bienvenido al Hospital San Juan de Dios de Riosucio. Le saluda Lucía, asistente virtual. Esta llamada se graba para atender su solicitud. ¿En qué le puedo ayudar?']];
  const P=t=>L.push(['Paciente',t]),A=t=>L.push(['Lucía',t]);
  const tr=()=>{const r=c.resultado_transferencia;
    if(r==='fuera_de_horario'){A('En este momento las extensiones están cerradas; atienden de lunes a viernes de ocho de la mañana a seis de la tarde, y los sábados de ocho a una. Le dejo registrada su solicitud y lo contactarán por teléfono o por WhatsApp.');P('Bueno, gracias.');}
    else{A('Con mucho gusto lo voy a transferir. Por favor, espere un momento en línea.');
      if(r==='exitosa')L.push(['Sistema','Transferencia a la extensión de '+EXT[c.extension_destino]+': contestada.']);
      else{L.push(['Sistema','Transferencia a la extensión de '+EXT[c.extension_destino]+': sin respuesta.']);A('En este momento no hay un asesor disponible. Le dejo registrada su solicitud y lo contactarán por teléfono o por WhatsApp.');P('Está bien.');}}};
  switch(c.motivo_llamada){
    case 'cita_nueva':
      P('Buenos días, quiero pedir una cita'+(c.especialidad?' de '+c.especialidad.toLowerCase():'')+'.');
      A('Con mucho gusto. ¿Es primera vez o control?');P(c.tipo_cita==='control'?'Es control.':'Primera vez.');
      A('¿Con qué EPS está afiliado el paciente?');P(c.eps+'.');
      A('¿Ya tiene la orden médica o la autorización?');
      if(c.tiene_orden){P('Sí, ya la tengo.');}else{P('No, todavía no.');A('Qué pena, para la cita la va a necesitar. Igual le tomo los datos.');}
      A('¿Me regala el número de cédula del paciente?');P(c.cedula_paciente+'.');
      A('¿Y su nombre completo?');P(c.nombre_completo.replace(/ \(.*\)/,'')+'.');
      A('¿A qué teléfono lo podemos contactar?');P('Al '+c.telefono_contacto+'.');
      A('Listo, ya quedó registrada su solicitud. Un asesor del hospital se comunicará con usted por teléfono o por WhatsApp para confirmarle la fecha, la hora y el especialista con el que queda su cita.');P('Muchas gracias.');break;
    case 'informacion_basica':
      P(c.pregunta||'Quería preguntar un horario.');
      if(c.requiere_transferencia){A('Qué pena, no tengo esa información aquí.');tr();}
      else{A(c.respuesta||'Con gusto le cuento.');P('Perfecto, gracias.');}
      break;
    case 'urgencia':
      P('Señorita, mi papá tiene un dolor muy fuerte en el pecho y le cuesta respirar.');
      A('Esto puede ser una urgencia. Por favor, acuda ya al servicio de urgencias del hospital o llame al uno, dos, tres.');P('Ya mismo salimos, gracias.');break;
    default:
      P(c.pregunta||c.resumen);
      if(c.motivo_llamada==='pqrs'&&!c.felicitacion)A('Entiendo su molestia, y le agradezco que nos lo cuente.');
      if(c.motivo_llamada==='pqrs'&&c.felicitacion)A('Qué alegría escuchar eso. Con gusto lo comunico con el SIAU para que quede registrada.');
      if(c.requiere_transferencia)tr();else{A(c.respuesta||'Qué pena, esta es la línea del Hospital San Juan de Dios de Riosucio.');P('Ah, bueno. Gracias.');}
  }
  A('¿Le puedo ayudar con algo más?');P('No, eso era todo.');
  A('Muchas gracias por llamar al Hospital San Juan de Dios de Riosucio. Que tenga un excelente día.');
  return L;
}


const D=(day,h,m)=>new Date(2026,10,day,h,m);
let seq=1;
/* Generador con semilla: mismas llamadas en cada carga. */
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(20261105);
const pick=a=>a[Math.floor(R()*a.length)];
const wpick=o=>{const e=Object.entries(o),s=e.reduce((a,[,w])=>a+w,0);let r=R()*s;for(const [k,w] of e){if((r-=w)<0)return k}return e[0][0]};
const between=(a,b)=>a+R()*(b-a);
const hex=n=>Array.from({length:n},()=>Math.floor(R()*16).toString(16)).join('');

const base={tipo_cita:'',especialidad:'',eps:'',tiene_orden:null,consulta_basica:false,urgencia_detectada:false,requiere_transferencia:false,extension_destino:'ninguna',tema_consulta:'',fecha:'',hora:'',especialista:''};
const DUR={cita_nueva:[120,215],gestion_cita:[55,95],informacion_basica:[35,85],resultados_autorizaciones:[40,75],pqrs:[55,110],urgencia:[22,45],otro:[28,60]};

function finish(c){
  c.id=c.id||'LL-'+String(1040+seq++);c.envios=c.envios||[];
  c.call_id=c.call_id||'call_'+hex(24);
  if(c.requiere_transferencia){if(!c.resultado_transferencia)c.resultado_transferencia=enHorario(c.hora_llamada)?'exitosa':'fuera_de_horario';}
  else c.resultado_transferencia='no_aplica';
  if(c.motivo_llamada==='informacion_basica'&&!c.tema_consulta)c.tema_consulta=c.requiere_transferencia?'fuera_guia':'horarios';
  c.transferida=c.resultado_transferencia==='exitosa';
  c.resuelta_por_asistente=!c.requiere_transferencia;
  c.en_horario=enHorario(c.hora_llamada);
  c.franja=franjaDe(c.hora_llamada);
  if(!c.duracion_s){const d=DUR[c.motivo_llamada]||[40,90];c.duracion_s=Math.round(between(d[0],d[1])+(c.requiere_transferencia?25:0))}
  if(!c.sentimiento)c.sentimiento=['no_contesto','fuera_de_horario'].includes(c.resultado_transferencia)?(R()<.45?'Negative':'Neutral'):(c.motivo_llamada==='pqrs'&&!c.felicitacion?'Negative':(R()<.72?'Positive':'Neutral'));
  c.desconexion=c.transferida?'call_transfer':c.urgencia_detectada?'user_hangup':(R()<.8?'agent_hangup':'user_hangup');
  if(!c.estado)c.estado=c.motivo_llamada==='cita_nueva'?'por_confirmar':(['no_contesto','fuera_de_horario'].includes(c.resultado_transferencia)?'devolver_llamada':'cerrada');
  return c;
}

/* ----- Catálogos para el generador (nombres y números ficticios) ----- */
const NOM_F=['María','Luz','Gloria','Blanca','Rosa','Martha','Ana','Sandra','Diana','Paola','Yuliana','Nubia','Carolina','Lina','Claudia','Olga','Esperanza','Leidy','Natalia','Angélica','Viviana','Daniela','Marleny','Aleida','Adriana'];
const NOM_M=['José','Juan','Carlos','Luis','Jorge','Fabio','Héctor','Jhon','Andrés','Diego','Óscar','Libardo','Arnulfo','Edwin','Yeison','Camilo','Gustavo','Álvaro','Hernán','Wilson','Duván','Mauricio','Albeiro','Jairo','Ancízar'];
const SEG=['Inés','Elena','Patricia','Cristina','Fernanda','Milena','Andrea','Lucía','Antonio','Alberto','Fernando','Alonso','David','Mario','Arturo','Eduardo'];
const APE=['Tapasco','Bañol','Largo','Ladino','Restrepo','Ospina','Arias','Moreno','Cardona','Gómez','Valencia','Hernández','Motato','Guapacha','Calvo','Trejos','Díaz','Castaño','Morales','Bueno','Gañán','Vinasco','Úsuga','Cataño','Grajales','Tabares','Salazar','Rendón','Montoya','Aricapa','Uchima','Guerrero'];
function persona(){const f=R()<.6,n=pick(f?NOM_F:NOM_M);
  const segN=R()<.55?' '+pick(SEG.filter(x=>f?!/o$/.test(x):/o$/.test(x))||SEG):'';
  const ap=pick(APE)+(R()<.6?' '+pick(APE):'');
  const ced=R()<.45?('1.0'+(55+Math.floor(R()*7))+'.'+String(Math.floor(R()*1000)).padStart(3,'0')+'.'+String(Math.floor(R()*1000)).padStart(3,'0')):(f?'24.':'4.')+String(100+Math.floor(R()*900))+'.'+String(Math.floor(R()*1000)).padStart(3,'0');
  return {nombre_completo:n+segN+' '+ap,cedula_paciente:ced,telefono_contacto:'3'+String(10+Math.floor(R()*14))+' *** '+String(Math.floor(R()*10000)).padStart(4,'0')}}

const ESP={'Medicina general':34,'Odontología':14,'Pediatría':10,'Ginecología':9,'Medicina interna':8,'Ortopedia':6,'Psicología':5,'Nutrición':4,'Cirugía general':4,'Ecografía':6};
const EPS={'Nueva EPS':40,'Asmet Salud':20,'Salud Total':15,'Pijaos Salud':11,'Sanitas':8,'Otra':6};
const INFO=[
 ['horarios','¿A qué hora atienden el laboratorio?','El laboratorio toma muestras de lunes a sábado, de seis y media a nueve y media de la mañana. La mayoría de exámenes de sangre son en ayunas.',14],
 ['horarios','¿A qué hora entregan los resultados?','Los resultados se entregan de lunes a viernes, de dos a cinco de la tarde.',9],
 ['horarios','¿Hasta qué hora es la consulta externa?','Consulta externa atiende de lunes a viernes de siete de la mañana a cinco de la tarde, y los sábados de siete a doce del día.',8],
 ['horarios','¿A qué hora son las visitas?','Las visitas a hospitalizados son todos los días de dos a cuatro de la tarde, un visitante por paciente.',8],
 ['horarios','¿Qué días vacunan?','Vacunación atiende de lunes a viernes de ocho de la mañana a cuatro de la tarde.',6],
 ['horarios','¿La farmacia abre el sábado?','Sí, la farmacia atiende los sábados de ocho de la mañana a una de la tarde.',6],
 ['ubicacion','¿Dónde queda el hospital?','Quedamos en la carrera cinco número dieciocho diecisiete, avenida Fundadores, frente al Coliseo Municipal.',7],
 ['ubicacion','¿Cuál es la línea gratuita?','La línea gratuita es cero uno ocho mil, uno ocho nueve, ocho dos siete.',3],
 ['eps','¿Ustedes atienden Asmet Salud?','Sí. Tenemos convenio con Nueva EPS, Salud Total, Sanitas, Asmet Salud y Pijaos Salud.',8],
 ['requisitos','¿Qué tengo que llevar a la cita?','Llegue quince minutos antes con el documento del paciente y, si aplica, la orden médica o la autorización.',8],
 ['servicios','¿Ustedes tienen pediatra?','Sí, el hospital tiene pediatría. Si quiere, le tomo los datos para la cita.',6],
 ['servicios','¿Hacen ecografías?','Sí, hacemos ecografías. Para pedirla necesita la orden médica.',5]
];
const FUERA=['¿Ustedes hacen resonancias magnéticas?','¿Tienen dermatólogo?','¿Cuánto cuesta una consulta particular?','¿Me puede dar el celular del médico que me atendió?','¿Cuándo vuelve el especialista de otorrino?'];
const GEST=[['confirmar','Llamo para confirmar mi cita de '],['cambiar','Necesito cambiar la cita de '],['cancelar','Quiero cancelar la cita de ']];
const LAB=['¿Ya están los resultados de la glicemia?','Llamo por los resultados del parcial de orina.','Quiero saber si ya llegaron los resultados del cuadro hemático.','¿Me pueden decir si ya están los exámenes de mi mamá?'];
const FACT=['Necesito la autorización para una ecografía.','Me cobraron una cuota moderadora y tengo una duda.','Necesito una copia de la factura de urgencias.','¿Cómo hago para que me autoricen la cita con el especialista?'];
const PQ=[['queja','Quiero poner una queja porque llevo días esperando la cita.'],['queja','Me trataron mal en la ventanilla y quiero que quede registrado.'],['queja','No me han entregado unos medicamentos.'],['sugerencia','Quiero hacer una sugerencia sobre la sala de espera.'],['felicitacion','Quiero felicitar a la enfermera que atendió a mi papá.']];
const OTRO=[[false,'Busco el teléfono de la alcaldía.','Qué pena, esta es la línea del Hospital San Juan de Dios de Riosucio. Le sugiero comunicarse directamente con la alcaldía.','Buscaba otra entidad. Se le indicó que es la línea del hospital.'],[false,'¿Ahí venden medicamentos sin fórmula?','Qué pena, la farmacia del hospital entrega medicamentos con fórmula médica.','Pregunta por compra de medicamentos sin fórmula. Se le explicó.'],[true,'Quiero saber si hay vacantes de trabajo en el hospital.','','Pregunta por vacantes de trabajo. Transferido a información.'],[true,'Necesito hablar con el área de mantenimiento.','','Pide comunicarse con un área administrativa. Transferido a información.']];

const HW=[0.25,0.15,0.12,0.12,0.25,0.7,2.4,5.6,7.6,7.1,6.1,5,3.4,3.3,4.3,4,3.2,2.4,1.7,1.25,0.95,0.65,0.45,0.32];
const NA={citas:.11,siau:.2,laboratorio:.14,facturacion:.13,informacion:.09};
function noContesta(ext,d){const h=d.getHours();let p=NA[ext];
  if(h>=12&&h<14)p*=ext==='laboratorio'?3.6:2.4;
  if(ext==='citas'&&h>=8&&h<10)p*=1.7;
  if(d.getDay()===6)p*=1.5;
  if(h>=17)p*=1.4;
  return R()<Math.min(p,.8)}

const extTxt=k=>k==='siau'?'SIAU':EXT[k].toLowerCase();
function generar(desde,hasta){
  const out=[];const d0=new Date(desde);d0.setHours(0,0,0,0);
  const total=(hasta-d0)/864e5;
  for(let d=new Date(d0);d<hasta;d.setDate(d.getDate()+1)){
    const w=d.getDay(),fest=esFestivo(d),prog=(d-d0)/864e5/total;
    let n=w===0||fest?6:w===6?13:34*(w===1?1.22:w===5?.9:1);
    n=Math.round(n*(0.86+prog*0.24)*(0.85+R()*0.3));
    const hw=HW.map((x,h)=>w===6?(h>=13?x*.35:x):(w===0||fest)?(h>=6&&h<20?1:.3):x);
    for(let i=0;i<n;i++){
      const h=+wpick(Object.fromEntries(hw.map((x,j)=>[j,x])));
      const t=new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,Math.floor(R()*60),Math.floor(R()*60));
      if(t>hasta)continue;
      const noche=h<6||h>=19;
      const mot=wpick({cita_nueva:30,gestion_cita:13,informacion_basica:noche?36:28,resultados_autorizaciones:noche?6:14,pqrs:6,urgencia:noche?6:1.4,otro:4.5});
      const c={...base,...persona(),hora_llamada:t,motivo_llamada:mot};
      if(mot==='cita_nueva'){
        c.especialidad=wpick(ESP);c.tipo_cita=R()<.56?'primera_vez':'control';c.eps=wpick(EPS);
        c.tiene_orden=c.especialidad==='Medicina general'||c.especialidad==='Odontología'?R()<.93:R()<.72;
        c.resumen=`Pide ${c.especialidad.toLowerCase()} (${c.tipo_cita==='control'?'control':'primera vez'}), ${c.eps}. ${c.tiene_orden?'Tiene orden.':'No tiene la orden; se le indicó que la necesita.'}`;
      }else if(mot==='gestion_cita'){
        const g=pick(GEST);c.especialidad=wpick(ESP);c.tipo_cita='control';c.eps=wpick(EPS);c.tiene_orden=true;
        c.requiere_transferencia=true;c.extension_destino='citas';c.pregunta=g[1]+c.especialidad.toLowerCase()+'.';
        c.resumen=`Quiere ${g[0]} su cita de ${c.especialidad.toLowerCase()}.`;
      }else if(mot==='informacion_basica'){
        if(R()<.11){c.requiere_transferencia=true;c.extension_destino='informacion';c.tema_consulta='fuera_guia';c.pregunta=pick(FUERA);c.resumen='Pregunta algo que no está en la guía: «'+c.pregunta.replace(/[¿?]/g,'')+'».'}
        else{const q=INFO[+wpick(Object.fromEntries(INFO.map((x,j)=>[j,x[3]])))];c.consulta_basica=true;c.tema_consulta=q[0];c.pregunta=q[1];c.respuesta=q[2];c.resumen='Pregunta: «'+q[1].replace(/[¿?]/g,'')+'». Resuelto por Lucía.'}
      }else if(mot==='resultados_autorizaciones'){
        c.requiere_transferencia=true;c.eps=wpick(EPS);
        if(R()<.55){c.extension_destino='laboratorio';c.pregunta=pick(LAB);c.resumen='Pregunta por resultados de laboratorio.'}
        else{c.extension_destino='facturacion';c.pregunta=pick(FACT);c.resumen='Trámite de autorización o facturación.'}
      }else if(mot==='pqrs'){
        const p=pick(PQ);c.requiere_transferencia=true;c.extension_destino='siau';c.pregunta=p[1];c.felicitacion=p[0]==='felicitacion';
        c.resumen={queja:'Queja',sugerencia:'Sugerencia',felicitacion:'Felicitación'}[p[0]]+': '+(t=>t.charAt(0).toLowerCase()+t.slice(1))(p[1].replace(/^Quiero (poner una queja porque|hacer una sugerencia sobre|felicitar a) ?/,'').replace(/\.$/,''))+'.';
      }else if(mot==='urgencia'){
        c.urgencia_detectada=true;c.resumen='Describe síntomas de urgencia. Se le indicó ir a urgencias o llamar al 123.';
      }else{
        const o=pick(OTRO);c.requiere_transferencia=o[0];if(o[0])c.extension_destino='informacion';c.pregunta=o[1];c.respuesta=o[2];c.resumen=o[3];
      }
      if(c.requiere_transferencia)c.resultado_transferencia=!enHorario(t)?'fuera_de_horario':noContesta(c.extension_destino,t)?'no_contesto':'exitosa';
      if(c.requiere_transferencia&&c.motivo_llamada!=='otro'){const r=c.resultado_transferencia;c.resumen+=r==='exitosa'?' Transferido a '+extTxt(c.extension_destino)+'.':r==='no_contesto'?' La extensión de '+extTxt(c.extension_destino)+' no contestó.':' Llamó fuera del horario de las extensiones.'}
      /* Estado de seguimiento en el CRM, según la antigüedad de la llamada. */
      const age=(NOW-t)/864e5;
      if(mot==='cita_nueva'){
        c.estado=age<1?(R()<.85?'por_confirmar':'confirmacion_enviada'):age<3?wpick({por_confirmar:2,confirmacion_enviada:4,recordatorio_enviado:4}):(R()<.04?'por_confirmar':'cerrada');
        if(c.estado!=='por_confirmar'){const t1=new Date(+t+between(1,20)*36e5);c.envios=[{t:t1,txt:'Plantilla «Confirmar cita» enviada por WhatsApp'}];
          if(c.estado!=='confirmacion_enviada')c.envios.push({t:new Date(+t1+between(30,90)*36e5),txt:'Plantilla «Recordatorio» enviada por WhatsApp'});}
      }else if(['no_contesto','fuera_de_horario'].includes(c.resultado_transferencia)){
        c.estado=age<1.5&&R()<.8?'devolver_llamada':'cerrada';
        if(c.estado==='cerrada')c.envios=[{t:new Date(+t+between(1,26)*36e5),txt:'Plantilla «Le devolvemos la llamada» enviada por WhatsApp'}];
      }
      out.push(finish(c));
    }
  }
  return out;
}

const DESTACADAS=[
 {hora_llamada:D(5,8,30),nombre_completo:'María Fernanda Guapacha',cedula_paciente:'1.002.554.810',telefono_contacto:'315 *** 6602',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿Con qué EPS atienden y a qué hora vacunan?',respuesta:'Atendemos Nueva EPS, Salud Total, Sanitas, Asmet Salud y Pijaos Salud. Vacunación es de lunes a viernes de ocho de la mañana a cuatro de la tarde.',resumen:'Pregunta qué EPS atienden y el horario de vacunación. Resuelto por el asistente.'},
 {hora_llamada:D(5,7,33),nombre_completo:'Juan David Bueno',cedula_paciente:'1.058.204.663',telefono_contacto:'314 *** 9020',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿A qué hora abre el laboratorio y hay que ir en ayunas?',respuesta:'El laboratorio atiende de lunes a sábado de seis y media a nueve y media de la mañana, y la mayoría de exámenes de sangre son en ayunas.',resumen:'Pregunta el horario del laboratorio y si debe ir en ayunas. Resuelto por el asistente.'},
 {hora_llamada:D(5,6,40),nombre_completo:'Martha Lucía Grajales',cedula_paciente:'25.112.430',telefono_contacto:'316 *** 2207',motivo_llamada:'resultados_autorizaciones',requiere_transferencia:true,extension_destino:'facturacion',pregunta:'Necesito hablar con facturación por un cobro de copago.',resumen:'Pide hablar con facturación por un cobro de copago. Llamó fuera del horario de las extensiones.'},
 {hora_llamada:D(5,3,15),nombre_completo:'Ancízar Hernández',cedula_paciente:'75.033.442',telefono_contacto:'318 *** 0915',motivo_llamada:'urgencia',urgencia_detectada:true,resumen:'Describe dolor fuerte en el pecho de su papá. Se le indicó ir a urgencias o llamar al 123.'},
 {hora_llamada:D(4,21,10),nombre_completo:'José Ignacio Tabares',cedula_paciente:'9.870.221',telefono_contacto:'312 *** 3381',motivo_llamada:'pqrs',eps:'Sanitas',requiere_transferencia:true,extension_destino:'siau',pregunta:'Quiero poner una queja porque no me han entregado unos medicamentos.',resumen:'Queja por demora en la entrega de medicamentos. Requería el SIAU, pero llamó fuera de horario.'},
 {hora_llamada:D(4,19,30),nombre_completo:'Héctor Fabio Motato',cedula_paciente:'15.917.334',telefono_contacto:'311 *** 5508',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿Dónde queda el hospital y a qué hora son las visitas?',respuesta:'Quedamos en la carrera cinco número dieciocho diecisiete, avenida Fundadores, frente al Coliseo. Las visitas son todos los días de dos a cuatro de la tarde.',resumen:'Pregunta dirección del hospital y horario de visitas. Resuelto.'},
 {hora_llamada:D(4,17,20),nombre_completo:'Libardo Antonio Úsuga',cedula_paciente:'15.910.087',telefono_contacto:'311 *** 1450',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿La farmacia abre el sábado?',respuesta:'Sí, la farmacia atiende los sábados de ocho de la mañana a una de la tarde.',resumen:'Pregunta horario de farmacia el sábado. Resuelto.'},
 {hora_llamada:D(4,16,40),nombre_completo:'Luz Mery Gañán (madre)',cedula_paciente:'1.059.880.412',telefono_contacto:'321 *** 1187',motivo_llamada:'cita_nueva',especialidad:'Pediatría',tipo_cita:'primera_vez',eps:'Asmet Salud',tiene_orden:true,resumen:'Solicita pediatría de primera vez para su hijo de 3 años. Tiene orden.'},
 {hora_llamada:D(4,15,5),nombre_completo:'Gloria Inés Cataño',cedula_paciente:'24.877.509',telefono_contacto:'314 *** 4418',motivo_llamada:'cita_nueva',especialidad:'Odontología',tipo_cita:'primera_vez',eps:'Nueva EPS',tiene_orden:true,resumen:'Solicita odontología de primera vez. Tiene autorización.',estado:'confirmacion_enviada',fecha:'martes 10 de noviembre',hora:'8:20 a. m.',especialista:'Dra. Paula Ríos (odontología)',envios:[{t:D(4,16,10),txt:'Plantilla «Confirmar cita» enviada por WhatsApp'}]},
 {hora_llamada:D(4,14,50),nombre_completo:'Diana Marcela Vinasco',cedula_paciente:'1.060.117.902',telefono_contacto:'320 *** 7745',motivo_llamada:'gestion_cita',especialidad:'Odontología',tipo_cita:'control',eps:'Pijaos Salud',tiene_orden:true,requiere_transferencia:true,extension_destino:'citas',resultado_transferencia:'no_contesto',pregunta:'Quiero cambiar mi cita de odontología del jueves.',resumen:'Quiere cambiar su cita de odontología del jueves. La extensión de citas no contestó.'},
 {hora_llamada:D(4,12,40),nombre_completo:'Teresa de Jesús Valencia',cedula_paciente:'24.300.981',telefono_contacto:'319 *** 3306',motivo_llamada:'resultados_autorizaciones',eps:'Nueva EPS',requiere_transferencia:true,extension_destino:'laboratorio',resultado_transferencia:'no_contesto',pregunta:'Quiero saber si ya están mis resultados de la glicemia.',resumen:'Pregunta por resultados de glicemia. La extensión de laboratorio no contestó (hora de almuerzo).'},
 {hora_llamada:D(4,11,45),nombre_completo:'Ómar Alonso Restrepo',cedula_paciente:'4.389.660',telefono_contacto:'310 *** 2214',motivo_llamada:'informacion_basica',requiere_transferencia:true,extension_destino:'informacion',pregunta:'¿Ustedes hacen resonancias magnéticas?',resumen:'Pregunta por resonancia magnética, que no está en la guía. Transferido a información.'},
 {hora_llamada:D(4,11,20),nombre_completo:'Rosa Elena Tapasco',cedula_paciente:'24.330.118',telefono_contacto:'312 *** 4471',motivo_llamada:'cita_nueva',especialidad:'Medicina interna',tipo_cita:'control',eps:'Nueva EPS',tiene_orden:true,resumen:'Pide control de medicina interna; tiene orden. Pendiente de asignar.'},
 {hora_llamada:D(4,10,30),nombre_completo:'Fabio Nelson Bermúdez',cedula_paciente:'4.390.552',telefono_contacto:'313 *** 8126',motivo_llamada:'gestion_cita',especialidad:'Medicina general',tipo_cita:'control',eps:'Salud Total',tiene_orden:true,requiere_transferencia:true,extension_destino:'citas',pregunta:'Necesito cancelar la cita de mañana con medicina general.',resumen:'Cancela su cita de medicina general. Transferido a citas.'},
 {hora_llamada:D(4,10,5),nombre_completo:'Carlos Arturo Largo',cedula_paciente:'4.512.009',telefono_contacto:'310 *** 6634',motivo_llamada:'resultados_autorizaciones',eps:'Salud Total',requiere_transferencia:true,extension_destino:'laboratorio',pregunta:'Llamo por los resultados de unos exámenes de la semana pasada.',resumen:'Pregunta por resultados de exámenes. Transferido a laboratorio.'},
 {hora_llamada:D(4,9,50),nombre_completo:'Jhon Fredy Castañeda',cedula_paciente:'1.058.660.214',telefono_contacto:'317 *** 4019',motivo_llamada:'pqrs',felicitacion:true,eps:'Nueva EPS',requiere_transferencia:true,extension_destino:'siau',pregunta:'Quiero felicitar a la enfermera que atendió a mi mamá en urgencias.',resumen:'Llama a felicitar al personal de urgencias. Transferido al SIAU.'},
 {hora_llamada:D(4,9,12),nombre_completo:'Nubia Cristina Bañol',cedula_paciente:'30.401.775',telefono_contacto:'313 *** 2290',motivo_llamada:'cita_nueva',especialidad:'Ginecología',tipo_cita:'control',eps:'Nueva EPS',tiene_orden:false,resumen:'Pide control de ginecología; no tiene la orden. Se le indicó que la necesita.'},
 {hora_llamada:D(4,8,10),nombre_completo:'Sandra Milena Ladino',cedula_paciente:'1.059.334.006',telefono_contacto:'322 *** 8870',motivo_llamada:'cita_nueva',especialidad:'Medicina general',tipo_cita:'primera_vez',eps:'Salud Total',tiene_orden:true,resumen:'Pide medicina general por dolor de garganta de varios días.',estado:'recordatorio_enviado',fecha:'lunes 9 de noviembre',hora:'10:40 a. m.',especialista:'Dr. Andrés Mejía (medicina general)',envios:[{t:D(4,9,0),txt:'Plantilla «Confirmar cita» enviada por WhatsApp'},{t:D(4,18,0),txt:'Plantilla «Recordatorio» enviada por WhatsApp'}]}
].map(c=>finish({...base,...c}));
const calls=generar(new Date(2026,7,1),NOW).concat(DESTACADAS).sort((a,b)=>b.hora_llamada-a.hora_llamada);

/* Lo que envía Flow al terminar la llamada (estructura de referencia del evento de análisis;
   el nombre exacto de cada campo se confirma con el primer evento real). */
function payload(c){
  const tx=transcript(c);const ini=+c.hora_llamada;
  return {event:'call_analyzed',call:{
    call_id:c.call_id,agent_name:'DEMO ESE RIOSUCIO',call_type:'phone_call',direction:'inbound',
    from_number:'+57 '+c.telefono_contacto,to_number:'+57 606 *** ****',
    start_timestamp:ini,end_timestamp:ini+c.duracion_s*1000,duration_ms:c.duracion_s*1000,
    disconnection_reason:c.desconexion,
    transfer_destination:c.transferida?'ext. '+EXTNUM[c.extension_destino]:null,
    recording_url:'https://…/recordings/'+c.call_id+'.wav',
    transcript:tx.map(([q,t])=>(q==='Lucía'?'Agent: ':q==='Sistema'?'[sistema] ':'User: ')+t).join('\n'),
    call_analysis:{call_summary:c.resumen,user_sentiment:c.sentimiento,call_successful:c.resultado_transferencia!=='no_contesto',
      custom_analysis_data:{motivo_llamada:c.motivo_llamada,consulta_basica:c.consulta_basica,resuelta_por_asistente:c.resuelta_por_asistente,transferida:c.transferida,extension_destino:c.extension_destino,
        requiere_transferencia:c.requiere_transferencia,resultado_transferencia:c.resultado_transferencia,tema_consulta:c.tema_consulta||null,
        especialidad:c.especialidad||null,tipo_cita:c.tipo_cita||null,eps:c.eps||null,tiene_orden:c.tiene_orden,
        cedula_paciente:c.cedula_paciente,nombre_completo:c.nombre_completo,telefono_contacto:c.telefono_contacto,urgencia_detectada:c.urgencia_detectada,resumen:c.resumen}}}};
}

return {MOTIVOS,EXT,EXTNUM,RES,ESTADO,TEMAS,FRANJAS,FESTIVOS,esFestivo,enHorario,franjaDe,NOW,PREP,TPL,transcript,finish,base,calls,payload,nextId:()=>'LL-'+String(1040+seq++)};
})();
