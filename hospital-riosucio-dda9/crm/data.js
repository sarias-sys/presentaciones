/* Datos de ejemplo y reglas del CRM de llamadas (en producción llegan por el webhook de Flow). */
window.CRM=(function(){

const MOTIVOS={
  cita_nueva:{n:'Cita nueva',c:'oklch(0.56 0.13 350)'},
  gestion_cita:{n:'Gestión de cita',c:'oklch(0.5 0.13 300)'},
  informacion_basica:{n:'Información básica',c:'oklch(0.55 0.12 255)'},
  resultados_autorizaciones:{n:'Resultados y autorizaciones',c:'oklch(0.6 0.1 200)'},
  facturacion:{n:'Facturación',c:'oklch(0.55 0.09 160)'},
  pqrs:{n:'PQRS',c:'oklch(0.62 0.12 70)'},
  urgencia:{n:'Urgencia',c:'oklch(0.55 0.18 25)'},
  otro:{n:'Otro',c:'oklch(0.6 0.02 270)'}
};
const EXT={citas:'Citas',siau:'SIAU',laboratorio:'Laboratorio',facturacion:'Facturación',informacion:'Información',ninguna:'—'};
const RES={exitosa:['Transferida con éxito','ok'],no_contesto:['No contestó la extensión','bad'],fuera_de_horario:['Fuera de horario','wa'],no_aplica:['No requería transferencia','']};
const ESTADO={por_confirmar:['Cita por confirmar','wa'],confirmacion_enviada:['Confirmación enviada','ac'],recordatorio_enviado:['Recordatorio enviado','ok'],cerrada:['Cerrada',''],devolver_llamada:['Devolver llamada','bad']};

/* Horario de las extensiones: lunes a viernes 8 a. m. a 6 p. m.; sábado 8 a. m. a 1 p. m. */
function enHorario(d){const w=d.getDay(),h=d.getHours()+d.getMinutes()/60;if(w>=1&&w<=5)return h>=8&&h<18;if(w===6)return h>=8&&h<13;return false}

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

/* Transcripción: se arma con los datos de la llamada (en producción llega en el webhook). */
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
      if(c.motivo_llamada==='pqrs')A('Entiendo su molestia, y le agradezco que nos lo cuente.');
      tr();
  }
  A('¿Le puedo ayudar con algo más?');P('No, eso era todo.');
  A('Muchas gracias por llamar al Hospital San Juan de Dios de Riosucio. Que tenga un excelente día.');
  return L;
}

const D=(day,h,m)=>new Date(2026,10,day,h,m);
let seq=1;
const base={tipo_cita:'',especialidad:'',eps:'',tiene_orden:null,consulta_basica:false,urgencia_detectada:false,requiere_transferencia:false,extension_destino:'ninguna',fecha:'',hora:'',especialista:''};
function finish(c){
  c.id=c.id||'LL-'+String(1040+seq++);c.envios=c.envios||[];
  if(c.requiere_transferencia){if(!c.resultado_transferencia)c.resultado_transferencia=enHorario(c.hora_llamada)?'exitosa':'fuera_de_horario';}
  else c.resultado_transferencia='no_aplica';
  c.transferida=c.resultado_transferencia==='exitosa';
  c.resuelta_por_asistente=!c.requiere_transferencia;
  if(!c.estado)c.estado=c.motivo_llamada==='cita_nueva'?'por_confirmar':(['no_contesto','fuera_de_horario'].includes(c.resultado_transferencia)?'devolver_llamada':'cerrada');
  c.transcripcion=transcript(c);return c;
}
let calls=[
 {hora_llamada:D(5,8,30),nombre_completo:'María Fernanda Guapacha',cedula_paciente:'1.002.554.810',telefono_contacto:'315 *** 6602',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿Con qué EPS atienden y a qué hora vacunan?',respuesta:'Atendemos Nueva EPS, Salud Total, Sanitas, Asmet Salud y Pijaos Salud. Vacunación es de lunes a viernes de ocho de la mañana a cuatro de la tarde.',resumen:'Pregunta qué EPS atienden y el horario de vacunación. Resuelto por el asistente.'},
 {hora_llamada:D(5,7,33),nombre_completo:'Juan David Bueno',cedula_paciente:'1.058.204.663',telefono_contacto:'314 *** 9020',motivo_llamada:'informacion_basica',consulta_basica:true,pregunta:'¿A qué hora abre el laboratorio y hay que ir en ayunas?',respuesta:'El laboratorio atiende de lunes a sábado de seis y media a nueve y media de la mañana, y la mayoría de exámenes de sangre son en ayunas.',resumen:'Pregunta el horario del laboratorio y si debe ir en ayunas. Resuelto por el asistente.'},
 {hora_llamada:D(5,6,40),nombre_completo:'Martha Lucía Grajales',cedula_paciente:'25.112.430',telefono_contacto:'316 *** 2207',motivo_llamada:'facturacion',requiere_transferencia:true,extension_destino:'facturacion',pregunta:'Necesito hablar con facturación por un cobro de copago.',resumen:'Pide hablar con facturación por un cobro de copago. Llamó fuera del horario de las extensiones.'},
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
 {hora_llamada:D(4,9,50),nombre_completo:'Jhon Fredy Castañeda',cedula_paciente:'1.058.660.214',telefono_contacto:'317 *** 4019',motivo_llamada:'pqrs',eps:'Nueva EPS',requiere_transferencia:true,extension_destino:'siau',pregunta:'Quiero felicitar a la enfermera que atendió a mi mamá en urgencias.',resumen:'Llama a felicitar al personal de urgencias. Transferido al SIAU.'},
 {hora_llamada:D(4,9,12),nombre_completo:'Nubia Cristina Bañol',cedula_paciente:'30.401.775',telefono_contacto:'313 *** 2290',motivo_llamada:'cita_nueva',especialidad:'Ginecología',tipo_cita:'control',eps:'Nueva EPS',tiene_orden:false,resumen:'Pide control de ginecología; no tiene la orden. Se le indicó que la necesita.'},
 {hora_llamada:D(4,8,10),nombre_completo:'Sandra Milena Ladino',cedula_paciente:'1.059.334.006',telefono_contacto:'322 *** 8870',motivo_llamada:'cita_nueva',especialidad:'Medicina general',tipo_cita:'primera_vez',eps:'Salud Total',tiene_orden:true,resumen:'Pide medicina general por dolor de garganta de varios días.',estado:'recordatorio_enviado',fecha:'lunes 9 de noviembre',hora:'10:40 a. m.',especialista:'Dr. Andrés Mejía (medicina general)',envios:[{t:D(4,9,0),txt:'Plantilla «Confirmar cita» enviada por WhatsApp'},{t:D(4,18,0),txt:'Plantilla «Recordatorio» enviada por WhatsApp'}]}
].map(c=>finish({...base,...c}));

return {MOTIVOS,EXT,RES,ESTADO,enHorario,PREP,TPL,transcript,finish,base,calls,nextId:()=>'LL-'+String(1040+seq++)};
})();
