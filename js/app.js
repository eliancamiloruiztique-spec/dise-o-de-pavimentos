
/* ================================================================
   ESTADO
================================================================ */
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const W=1280,H=640,CY=320;          // lienzo y línea de rasante
let tipo='flexible',metodo='esal',calculado=false,dirty=false;
let animT=0,nubeOff=0;

/* Subrasante y condiciones de instalación del geotextil (comunes) */
let sub={cbr:5,condiciones:'moderadas',lift:200};

let pf={
  W18:5e6,R:90,So:0.45,p0:4.2,pt:2.5,
  MrSub:0,        // MPa; 0 = automático desde CBR
  MrBase:200,MrSubb:100,   // MPa
  capas:[
    {nom:"Carpeta AC",a:0.44,m:1.0,D:0,col:'#2a2a2f'},
    {nom:"Base granular",a:0.14,m:1.0,D:0,col:'#8b6f3a'},
    {nom:"Subbase granular",a:0.11,m:1.0,D:0,col:'#c4a46a'}
  ],
  SNs:[0,0,0],SN_req:0,SN_prov:0,MrSubUsado:0,mins:[0,0],warn:[]
};
let pr={
  W18:5e6,R:90,So:0.35,p0:4.5,pt:2.5,
  Ec:27579,Sc:4.5,Cd:1.0,J:3.2,
  k:0,            // MN/m³; 0 = automático desde CBR
  D_losa:0,D_base:150,kUsado:0,warn:[]
};
let transito={crec:3,anios:20,dir:0.5,carril:1.0};
let vehiculos={bus:200,c2:150,c3:100,c4:80,c5:60,c6:40};
let factoresF={bus:1.0,c2:2.0,c3:3.0,c4:4.0,c5:4.5,c6:5.5};
let factoresR={bus:1.2,c2:2.6,c3:4.2,c4:5.6,c5:6.3,c6:7.7};

/* ================================================================
   BASE DE DATOS — AASHTO M288-00
================================================================ */
const M288 = {
  tabla1: {
    'Clase 1': {
      elong_menor_50: { grab:1400, costura:1260, rasgado:500, punzonado:500 },
      elong_mayor_50: { grab: 900, costura: 810, rasgado:350, punzonado:350 }
    },
    'Clase 2': {
      elong_menor_50: { grab:1100, costura: 990, rasgado:400, punzonado:400 },
      elong_mayor_50: { grab: 700, costura: 630, rasgado:250, punzonado:250 }
    },
    'Clase 3': {
      elong_menor_50: { grab: 800, costura: 720, rasgado:300, punzonado:300 },
      elong_mayor_50: { grab: 500, costura: 450, rasgado:180, punzonado:180 }
    }
  },
  tabla2: {
    id:'M288-T2', titulo:'Drenaje Subsuperficial', ref:'AASHTO M288-00 — Tabla 2',
    funcion:'Filtración', clase:'Clase 2',
    requerimientos:{
      '% pasa Tamiz No. 200 < 15':   { permitividad:0.5, TAA:0.43 },
      '15 ≤ % pasa Tamiz No. 200 ≤ 50':{ permitividad:0.2, TAA:0.25 },
      '% pasa Tamiz No. 200 > 50':   { permitividad:0.1, TAA:0.22 }
    },
    UV:'50% retención después de 500 h (ASTM D4355)',
    notas:[
      'No se aceptan geotextiles tejidos de película cortada (listones planos).',
      'Los valores de TAA son máximos promedios por rollo (VMPR).',
      'El Ingeniero puede especificar Clase 3 si demuestra supervivencia suficiente.'
    ]
  },
  tabla3: {
    id:'M288-T3', titulo:'Separación', ref:'AASHTO M288-00 — Tabla 3',
    funcion:'Separación entre subrasante y agregado', clase:'Clase 2',
    aplica:'CBR ≥ 3 (τ ≈ 90 kPa)',
    requerimientos:{
      'Permitividad':{ valor:0.02, unidad:'s⁻¹', metodo:'ASTM D4491' },
      'TAA':         { valor:0.60, unidad:'mm máx prom/rollo', metodo:'ASTM D4751' },
      'UV':          { valor:'50% después de 500 h', metodo:'ASTM D4355' }
    },
    notas:[
      'Aplicable a subrasantes NO saturadas.',
      'Función principal: separación (evitar contaminación de capas).',
      'El Ingeniero puede especificar Clase 3 si demuestra supervivencia en campo.'
    ]
  },
  tabla4: {
    id:'M288-T4', titulo:'Estabilización', ref:'AASHTO M288-00 — Tabla 4',
    funcion:'Separación + Filtración + Refuerzo', clase:'Clase 1',
    aplica:'CBR < 3 (subrasantes blandas / saturadas)',
    requerimientos:{
      'Permitividad':{ valor:0.05, unidad:'s⁻¹', metodo:'ASTM D4491' },
      'TAA':         { valor:0.43, unidad:'mm máx prom/rollo', metodo:'ASTM D4751' },
      'UV':          { valor:'50% después de 500 h', metodo:'ASTM D4355' }
    },
    notas:[
      'Aplicable a subrasantes saturadas (nivel freático alto o humedad prolongada).',
      'NO aplica para refuerzo de terraplenes con fallas globales.',
      'El Ingeniero puede especificar Clase 2 o 3 con justificación.'
    ]
  },
  tabla5: {
    id:'M288-T5', titulo:'Control Permanente de Erosión', ref:'AASHTO M288-00 — Tabla 5',
    funcion:'Filtración',
    requerimientos:{
      '>50% pasa Tamiz 200 — Geotextiles Tejidos Monofilamento':
        { clase:'Clase 2', permitividad:0.7, TAA:0.43 },
      '>50% pasa Tamiz 200 — Todos los demás geotextiles':
        { clase:'Clase 1', permitividad:0.2, TAA:0.25 },
      '≤50% pasa Tamiz 200':
        { clase:'Clase 1', permitividad:0.1, TAA:0.22 }
    },
    UV:'50% retención después de 500 h (ASTM D4355)',
    verificar:true,
    notas:[
      'No se admiten geotextiles tejidos de película cortada.',
      'El Ingeniero puede reducir requisitos si se demuestra menor daño constructivo.'
    ]
  },
  tabla6: {
    id:'M288-T6', titulo:'Barreras Temporales contra Sedimentos', ref:'AASHTO M288-00 — Tabla 6',
    funcion:'Filtración + sedimentación',
    verificar:true,
    requerimientos:{
      'Con soporte — Elong ≥ 50%': { grab_MD:400, grab_XD:400, permitividad:0.05, TAA:0.60, UV:'70%/500h', postes:'1.2 m' },
      'Con soporte — Elong < 50%': { grab_MD:550, grab_XD:450, permitividad:0.05, TAA:0.60, UV:'70%/500h', postes:'1.2 m' },
      'Sin soporte'              : { grab_MD:550, grab_XD:450, permitividad:0.05, TAA:0.60, UV:'70%/500h', postes:'2.0 m' }
    },
    notas:['Altura mínima sobre el piso: 750 mm.','Profundidad mínima de enterrado: 150 mm.']
  },
  tabla7: {
    id:'M288-T7', titulo:'Geotextil de Pavimentación', ref:'AASHTO M288-00 — Tabla 7',
    funcion:'Membrana impermeable / aliviadora de esfuerzos',
    requerimientos:[
      { prop:'Resistencia Grab',        metodo:'ASTM D4632', unidad:'N',    valor:450 },
      { prop:'Elongación en Rotura',    metodo:'ASTM D4632', unidad:'%',    valor:'≥ 50' },
      { prop:'Masa por Unidad de Área', metodo:'ASTM D5261', unidad:'g/m²', valor:140 },
      { prop:'Punto de Fusión',         metodo:'ASTM D276',  unidad:'°C',   valor:150 },
      { prop:'Retención de Asfalto',    metodo:'ASTM D6140', unidad:'—',    valor:'Reportar (certificado del fabricante)' }
    ],
    notas:[
      'Se satura con cemento asfáltico (tasa según fabricante / ASTM D6140).',
      'Temperatura del cemento asfáltico: 145°C mín, 160°C máx.',
      'Temperatura ambiente: ≥ 10°C (cementos) o ≥ 15°C (emulsiones).',
      'Traslape de juntas: 150 mm máx; segunda aplicación de sellador en traslapes.'
    ]
  },
  tablaA1: [
    { id:'a', condicion:'CBR ≥ 3',        traslape:'300 – 450 mm',     nota:'—' },
    { id:'b', condicion:'1 ≤ CBR < 3',    traslape:'0.60 – 1.00 m',    nota:'—' },
    { id:'c', condicion:'0.5 ≤ CBR < 1',  traslape:'1.00 m o costura', nota:'—' },
    { id:'d', condicion:'CBR < 0.5',      traslape:'Costura',          nota:'Obligatoria' },
    { id:'e', condicion:'Extremos de rollo (todos los casos)', traslape:'1.00 m o costura', nota:'—' }
  ]
};

/* ================================================================
   CORRELACIONES Y UTILIDADES NORMATIVAS
================================================================ */
// Mr (psi) desde CBR. Mr = 1500·CBR válido para CBR ≤ 10; por encima se extrapola (verificar).
function MrDesdeCBR_psi(cbr){ return cbr<=10 ? 1500*cbr : 15000*Math.pow(cbr/10,0.65); }
// k (MPa/m) desde CBR (correlación tipo PCA): k = 2.55 + 52.5·log10(CBR)
function kDesdeCBR(cbr){ return Math.max(5, 2.55+52.5*Math.log10(Math.max(cbr,0.5))); }

// Z_R por aproximación de Abramowitz–Stegun 26.2.23 (interpola cualquier R)
function getZR(R){
  R=Math.min(99.99,Math.max(50,R));
  const p=1-R/100;
  const t=Math.sqrt(-2*Math.log(p));
  const z=t-(2.515517+0.802853*t+0.010328*t*t)/(1+1.432788*t+0.189269*t*t+0.001308*t*t*t);
  return -Math.max(0,z);
}

// Mínimos AASHTO-93 (mm) de carpeta y base según W18
function minimosAASHTO(W18){
  if(W18<5e4)  return [25,100];
  if(W18<1.5e5)return [50,100];
  if(W18<5e5)  return [65,100];
  if(W18<2e6)  return [75,150];
  if(W18<7e6)  return [90,150];
  return [100,150];
}
const ceil5=x=>Math.ceil(x/5-1e-9)*5;

function bisect(f,lo,hi){
  const flo=f(lo),fhi=f(hi);
  if(flo>0)return {x:lo,estado:'min'};
  if(fhi<0)return {x:hi,estado:'max'};
  for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(f(mid)>0)hi=mid;else lo=mid;}
  return {x:(lo+hi)/2,estado:'ok'};
}

/* ================================================================
   SELECCIÓN DE GEOTEXTIL (M288-00)
================================================================ */
function traslapeSegunCBR(cbr){
  if(cbr>=3)   return {txt:'300 – 450 mm',id:'a',costura:false};
  if(cbr>=1)   return {txt:'0.60 – 1.00 m',id:'b',costura:false};
  if(cbr>=0.5) return {txt:'1.00 m o costura',id:'c',costura:false};
  return {txt:'Costura (obligatoria)',id:'d',costura:true};
}

function obtenerSugerencia(){
  const cbr=sub.cbr;
  const base=(cbr>=3)?{id:'separacion',tabla:M288.tabla3,label:'Separación (CBR ≥ 3)'}
                     :{id:'estabilizacion',tabla:M288.tabla4,label:(cbr>=1?'Estabilización (1 ≤ CBR < 3)':'Estabilización crítica (CBR < 1)')};
  const app=base;
  // Clase base de la aplicación y ajuste por supervivencia (criterio de ingeniería)
  let nivel=parseInt(app.tabla.clase.replace('Clase ',''),10);
  const motivos=[];
  if(sub.condiciones==='severas' && nivel>1){nivel=1;motivos.push('Condiciones de instalación severas → Clase 1');}
  if(sub.lift<150 && nivel>1){nivel=nivel-1;motivos.push('Primera capa granular < 150 mm → se sube una clase');}
  if(sub.condiciones==='leves' && nivel===2){motivos.push('Condiciones leves: el Ingeniero podría justificar Clase 3 (no se aplica automáticamente)');}
  const claseSeleccionada='Clase '+nivel;
  const trasl=traslapeSegunCBR(cbr);

  const r=app.tabla.requerimientos;
  const requerimientosApp=`
      <tr><td class="prop">Permitividad</td><td class="metodo">ASTM D4491</td><td class="val">${r['Permitividad'].valor} s⁻¹</td></tr>
      <tr><td class="prop">TAA</td><td class="metodo">ASTM D4751</td><td class="val">≤ ${r['TAA'].valor} mm</td></tr>
      <tr><td class="prop">Estabilidad UV</td><td class="metodo">ASTM D4355</td><td class="val">${r['UV'].valor}</td></tr>`;

  const advertencias=[];
  if(cbr<1) advertencias.push('CBR < 1: subrasante extremadamente blanda. La estabilización con geotextil puede no bastar; evalúe además mejoramiento del suelo, refuerzo con geomalla o mayor espesor de capa granular.');
  if(cbr<0.5) advertencias.push('CBR < 0.5: las uniones cosidas son obligatorias (no se admite traslape simple).');
  if(cbr>10) advertencias.push('CBR > 10: la correlación Mr–CBR se extrapola; use un Mr medido.');

  let color,emoji,titulo,resumen;
  if(app.id==='separacion'){
    color='#22c55e';emoji='✅';
    titulo=`Separación — Geotextil ${claseSeleccionada} (M288-00 Tabla 3)`;
    resumen=`Subrasante con CBR ≈ ${cbr.toFixed(2)} (≥ 3). Aplicación de separación entre subrasante y base/subbase para evitar la contaminación entre capas.`;
  }else if(cbr>=1){
    color='#f59e0b';emoji='🔶';
    titulo=`Estabilización — Geotextil ${claseSeleccionada} (M288-00 Tabla 4)`;
    resumen=`Subrasante con 1 ≤ CBR < 3 (≈ ${cbr.toFixed(2)}). Se requiere estabilización con funciones simultáneas de separación, filtración y refuerzo.`;
  }else{
    color='#ef4444';emoji='⚠️';
    titulo=`Estabilización crítica — Geotextil ${claseSeleccionada} (M288-00 Tabla 4 + A1)`;
    resumen=`Subrasante con CBR ≈ ${cbr.toFixed(2)} (< 1). Estabilización con geotextil ${claseSeleccionada}; traslape según Tabla A1: ${trasl.txt}.`;
  }
  return {cbr,app,claseSeleccionada,especifClase:M288.tabla1[claseSeleccionada],traslape:trasl.txt,traslapeId:trasl.id,costura:trasl.costura,
          requerimientosApp,color,emoji,titulo,resumen,motivos,advertencias,
          parametroBase:`CBR = ${cbr.toFixed(2)} (dato de subrasante)`};
}

/* ================================================================
   PANEL M288
================================================================ */
function renderM288(){
  const cont=document.getElementById('m288-content');
  if(!calculado){
    cont.innerHTML=`<div class="placeholder">
      Primero presione <strong style="color:var(--accent2)">Calcular</strong> para obtener la especificación de geotextiles según AASHTO M288-00.</div>`;
    return;
  }
  const s=obtenerSugerencia();
  const t1=s.especifClase;
  cont.innerHTML=`
    <div class="m288-card" style="border-left-color:${s.color}">
      <div class="m288-head">
        <div class="m288-title">${s.emoji} ${s.titulo}</div>
        <div class="m288-badge">AASHTO M288-00</div>
      </div>
      <div class="m288-sub">${s.resumen}</div>
      <div class="m288-grid-info">
        <div class="m288-info-box"><div class="k">Parámetro base</div><div class="v">${s.parametroBase}</div></div>
        <div class="m288-info-box"><div class="k">Aplicación</div><div class="v hl">${s.app.label}</div></div>
        <div class="m288-info-box"><div class="k">Clase geotextil</div><div class="v">${s.claseSeleccionada}</div></div>
        <div class="m288-info-box"><div class="k">Traslape mínimo</div><div class="v">${s.traslape}</div></div>
        <div class="m288-info-box"><div class="k">Condiciones de instalación</div><div class="v">${sub.condiciones} · capa ${sub.lift} mm</div></div>
      </div>
      ${s.motivos.length?`<div class="warn-list"><strong>Criterio de supervivencia:</strong><ul>${s.motivos.map(m=>`<li>${m}</li>`).join('')}</ul></div>`:''}
      ${s.advertencias.length?`<div class="warn-list err-box"><ul>${s.advertencias.map(m=>`<li>${m}</li>`).join('')}</ul></div>`:''}
    </div>

    <div class="m288-card">
      <div class="m288-head">
        <div class="m288-title">📏 Tabla 1 — Requerimientos de Resistencia (${s.claseSeleccionada})</div>
        <div class="m288-badge">VMPR dirección más débil</div>
      </div>
      <div class="m288-sub">Valores mínimos promedio por rollo (N). Resistencia de costura ≥ 90% del Grab cuando apliquen uniones cosidas.</div>
      <table class="m288-table">
        <thead><tr><th>Propiedad</th><th>Método</th><th>Elong &lt; 50%</th><th>Elong ≥ 50%</th></tr></thead>
        <tbody>
          <tr><td class="prop">Resistencia Grab</td><td class="metodo">ASTM D4632</td><td class="val">${t1.elong_menor_50.grab} N</td><td class="val">${t1.elong_mayor_50.grab} N</td></tr>
          <tr><td class="prop">Resistencia Costura</td><td class="metodo">ASTM D4632</td><td class="val">${t1.elong_menor_50.costura} N</td><td class="val">${t1.elong_mayor_50.costura} N</td></tr>
          <tr><td class="prop">Resistencia al Rasgado</td><td class="metodo">ASTM D4533</td><td class="val">${t1.elong_menor_50.rasgado} N</td><td class="val">${t1.elong_mayor_50.rasgado} N</td></tr>
          <tr><td class="prop">Resistencia al Punzonado</td><td class="metodo">ASTM D4833</td><td class="val">${t1.elong_menor_50.punzonado} N</td><td class="val">${t1.elong_mayor_50.punzonado} N</td></tr>
        </tbody>
      </table>
    </div>

    <div class="m288-card" style="border-left-color:${s.color}">
      <div class="m288-head">
        <div class="m288-title">🔬 ${s.app.tabla.titulo} — ${s.app.tabla.ref}</div>
        <div class="m288-badge">${s.app.tabla.clase} (tabla)</div>
      </div>
      <div class="m288-sub">${s.app.tabla.funcion} · Aplica: ${s.app.tabla.aplica}</div>
      <table class="m288-table">
        <thead><tr><th>Propiedad</th><th>Método</th><th>Valor requerido</th></tr></thead>
        <tbody>${s.requerimientosApp}</tbody>
      </table>
      <div class="m288-notas"><strong>Notas normativas:</strong>
        <ul style="margin-left:16px;margin-top:4px;">${s.app.tabla.notas.map(n=>`<li>${n}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="m288-card">
      <div class="m288-head">
        <div class="m288-title">📐 Tabla A1 — Traslapes mínimos según CBR</div>
        <div class="m288-badge">Apéndice A</div>
      </div>
      <table class="m288-table">
        <thead><tr><th>CBR del suelo</th><th>Traslape mínimo</th><th>Observación</th></tr></thead>
        <tbody>
          ${M288.tablaA1.map(r=>`<tr style="${r.id===s.traslapeId?'background:rgba(59,130,246,0.10);':''}">
            <td class="prop">${r.condicion}</td><td class="val">${r.traslape}</td><td class="metodo">${r.nota}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="m288-card" style="border-left-color:var(--purple)">
      <div class="m288-head">
        <div class="m288-title">📚 Otras aplicaciones M288-00</div>
        <div class="m288-badge">Referencia</div>
      </div>
      <div class="tabs-m288">
        <button class="tab-m288 active" onclick="showTabM288(this,'t2')">Tabla 2 · Drenaje</button>
        <button class="tab-m288" onclick="showTabM288(this,'t5')">Tabla 5 · Erosión</button>
        <button class="tab-m288" onclick="showTabM288(this,'t6')">Tabla 6 · Sedimentos</button>
        <button class="tab-m288" onclick="showTabM288(this,'t7')">Tabla 7 · Pavimentación</button>
      </div>
      <div id="tab-m288-content">${tabM288HTML('t2')}</div>
    </div>

    <div class="warn-list">Esta herramienta usa la edición <strong>M288-00</strong>. Existen ediciones posteriores (M288-06, M288-17) con cambios en tablas y clases; confirme con la edición exigida en su proyecto.</div>
  `;
}
function showTabM288(btn,id){
  document.querySelectorAll('.tab-m288').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-m288-content').innerHTML=tabM288HTML(id);
}
function tabM288HTML(id){
  const aviso='<div class="warn-list">⚠ Valores de esta tabla pendientes de verificar contra el PDF de la norma antes de usarlos.</div>';
  if(id==='t2'){
    const t=M288.tabla2;
    return `<div class="m288-sub">${t.ref} · ${t.funcion}</div>
      <table class="m288-table"><thead><tr><th>% pasa Tamiz 200</th><th>Permitividad (s⁻¹)</th><th>TAA (mm)</th><th>Clase</th></tr></thead>
      <tbody>${Object.entries(t.requerimientos).map(([k,v])=>`<tr><td class="prop">${k}</td><td class="val">${v.permitividad}</td><td class="val">${v.TAA}</td><td class="metodo">${t.clase}</td></tr>`).join('')}</tbody></table>
      <div class="m288-notas"><strong>UV:</strong> ${t.UV}</div>`;
  }
  if(id==='t5'){
    const t=M288.tabla5;
    return aviso+`<div class="m288-sub">${t.ref} · ${t.funcion}</div>
      <table class="m288-table"><thead><tr><th>Categoría</th><th>Permitividad (s⁻¹)</th><th>TAA (mm)</th><th>Clase</th></tr></thead>
      <tbody>${Object.entries(t.requerimientos).map(([k,v])=>`<tr><td class="prop">${k}</td><td class="val">${v.permitividad}</td><td class="val">${v.TAA}</td><td class="metodo">${v.clase}</td></tr>`).join('')}</tbody></table>
      <div class="m288-notas"><strong>UV:</strong> ${t.UV}</div>`;
  }
  if(id==='t6'){
    const t=M288.tabla6;
    return aviso+`<div class="m288-sub">${t.ref} · ${t.funcion}</div>
      <table class="m288-table"><thead><tr><th>Configuración</th><th>Grab MD (N)</th><th>Grab XD (N)</th><th>Perm. (s⁻¹)</th><th>TAA (mm)</th><th>Postes</th><th>UV</th></tr></thead>
      <tbody>${Object.entries(t.requerimientos).map(([k,v])=>`<tr><td class="prop">${k}</td><td class="val">${v.grab_MD}</td><td class="val">${v.grab_XD}</td><td class="val">${v.permitividad}</td><td class="val">${v.TAA}</td><td class="metodo">${v.postes}</td><td class="metodo">${v.UV}</td></tr>`).join('')}</tbody></table>
      <div class="m288-notas"><strong>Notas:</strong><ul style="margin-left:16px;">${t.notas.map(n=>`<li>${n}</li>`).join('')}</ul></div>`;
  }
  if(id==='t7'){
    const t=M288.tabla7;
    return `<div class="m288-sub">${t.ref} · ${t.funcion}</div>
      <table class="m288-table"><thead><tr><th>Propiedad</th><th>Método</th><th>Unidad</th><th>Valor</th></tr></thead>
      <tbody>${t.requerimientos.map(r=>`<tr><td class="prop">${r.prop}</td><td class="metodo">${r.metodo}</td><td class="metodo">${r.unidad}</td><td class="val">${r.valor}</td></tr>`).join('')}</tbody></table>
      <div class="m288-notas"><strong>Notas:</strong><ul style="margin-left:16px;">${t.notas.map(n=>`<li>${n}</li>`).join('')}</ul></div>`;
  }
  return '';
}

/* ================================================================
   UTILIDADES UI
================================================================ */
function setStatus(msg,cls){
  const el=document.getElementById('status-txt');
  el.innerHTML=cls?`<span class="${cls}">${msg}</span>`:msg;
}
function marcarSucio(){
  dirty=true;
  actualizarESALreadout();
  setStatus('Parámetros modificados — presione ▶ Calcular para actualizar.','warn');
}
function setTipo(t){
  tipo=t;calculado=false;dirty=false;
  document.getElementById('btn-flex').classList.toggle('active',t==='flexible');
  document.getElementById('btn-rig').classList.toggle('active',t==='rigido');
  document.getElementById('hdr-tipo').textContent=t.toUpperCase();
  setStatus('Modo cambiado a: '+t.toUpperCase(),'info');
  renderParams();renderQuick();
  document.getElementById('results-panel').style.display='none';
  document.getElementById('m288-panel').style.display='none';
}
function setMetodo(m){
  metodo=m;
  document.getElementById('metodo-esal').classList.toggle('active',m==='esal');
  document.getElementById('metodo-transito').classList.toggle('active',m==='transito');
  document.getElementById('transito-params').style.display=(m==='transito')?'block':'none';
  renderParams();
  setStatus('Método: '+(m==='esal'?'ESAL (W18)':'Tránsito → ESAL'),'info');
}
function togglePanel(id){
  const el=document.getElementById(id);
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  if(!open && id==='params-panel') renderParams();
  if(!open && id==='results-panel'){
    if(!calculado){setStatus('Primero presione Calcular.','err');el.style.display='none';return;}
    renderResults();
  }
  if(!open && id==='m288-panel') renderM288();
}
function entrarApp(){
  const a=document.getElementById('app');if(a)a.scrollIntoView({behavior:'smooth',block:'start'});
}
function abrirPanel(id){
  const el=document.getElementById(id);if(!el)return;
  if(id==='results-panel'&&!calculado){
    setStatus('Primero presione Calcular diseño para ver los resultados.','err');
    const a=document.getElementById('app');if(a)a.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  el.style.display='block';
  if(id==='params-panel')renderParams();
  if(id==='results-panel')renderResults();
  if(id==='m288-panel')renderM288();
  el.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderQuick(){
  const el=document.getElementById('quick-summary');if(!el)return;
  const P=(tipo==='flexible')?pf:pr;
  const sg=obtenerSugerencia();
  const chips=[['Tipo',tipo==='flexible'?'Flexible':'Rígido'],['W18',P.W18.toExponential(2)],['CBR',sub.cbr]];
  if(calculado){
    if(tipo==='flexible'){
      chips.push(['SN req / prov',pf.SN_req.toFixed(2)+' / '+pf.SN_prov.toFixed(2),1]);
      chips.push(['Espesores AC / BG / SB',pf.capas.map(c=>c.D).join(' / ')+' mm',1]);
    }else{
      chips.push(['Losa',pr.D_losa+' mm',1]);chips.push(['Base',pr.D_base+' mm']);
    }
    chips.push(['Geotextil',sg.claseSeleccionada+' · '+sg.app.label.split('(')[0].trim()]);
    chips.push(['Traslape',sg.traslape]);
  }else chips.push(['Estado','Sin calcular']);
  el.innerHTML=chips.map(c=>`<div class="chip${c[2]?' hl':''}"><div class="k">${c[0]}</div><div class="v">${c[1]}</div></div>`).join('');
}

/* ================================================================
   TRÁNSITO → ESAL (factor de daño propio por tipo de vehículo)
   ESAL = Σ(TPD_i · FD_i) · 365 · F_dir · F_carril · [((1+i)^n − 1)/i]
================================================================ */
function esalDesdeTransito(fac){
  const i=transito.crec/100,n=transito.anios;
  const gf=i>0?(Math.pow(1+i,n)-1)/i:n;
  let suma=0;for(const k in vehiculos)suma+=vehiculos[k]*fac[k];
  return Math.round(suma*365*transito.dir*transito.carril*gf);
}
function actualizarESALreadout(){
  const el=document.getElementById('esal-readout');if(!el)return;
  const total=Object.values(vehiculos).reduce((a,b)=>a+b,0);
  el.textContent=`Total comerciales: ${total} TPD · ESAL flexible = ${esalDesdeTransito(factoresF).toExponential(3)} · ESAL rígido = ${esalDesdeTransito(factoresR).toExponential(3)}`;
}

/* ================================================================
   RENDER PARÁMETROS
================================================================ */
function addField(grid,label,val,cb,o={}){
  const d=document.createElement('div');d.className='param-row';
  const l=document.createElement('label');l.textContent=label;d.appendChild(l);
  let inp;
  if(o.options){
    inp=document.createElement('select');
    o.options.forEach(([v,t])=>{const op=document.createElement('option');op.value=v;op.textContent=t;if(v===val)op.selected=true;inp.appendChild(op);});
    inp.addEventListener('change',e=>{cb(e.target.value);marcarSucio();});
  }else{
    inp=document.createElement('input');inp.type='number';inp.step=o.step||'any';inp.value=val;
    if(o.min!==undefined)inp.min=o.min;
    inp.addEventListener('change',e=>{const v=parseFloat(e.target.value);if(!isNaN(v)){cb(v);marcarSucio();}});
  }
  d.appendChild(inp);grid.appendChild(d);
}
function addGroup(root,title){
  const g=document.createElement('div');g.className='param-group';
  g.innerHTML=`<div class="group-title">${title}</div><div class="param-grid"></div>`;
  root.appendChild(g);return g.querySelector('.param-grid');
}

function renderParams(){
  const root=document.getElementById('params-grid');root.innerHTML='';
  document.getElementById('params-title').textContent='Parámetros – '+tipo;
  const P=(tipo==='flexible')?pf:pr;
  const fbox=document.getElementById('formula-box');

  const g1=addGroup(root,'Diseño AASHTO-93');
  if(metodo==='esal')addField(g1,'W18 — Ejes equivalentes (ESAL)',P.W18,v=>P.W18=v);
  addField(g1,'R — Confiabilidad (%)',P.R,v=>P.R=v);
  addField(g1,'So — Desviación estándar combinada',P.So,v=>P.So=v);
  addField(g1,'p₀ — Serviciabilidad inicial',P.p0,v=>P.p0=v);
  addField(g1,'pt — Serviciabilidad final',P.pt,v=>P.pt=v);

  if(tipo==='flexible'){
    const g2=addGroup(root,'Subrasante y materiales (flexible)');
    addField(g2,'CBR de subrasante (%)',sub.cbr,v=>sub.cbr=v);
    addField(g2,'Mr subrasante (MPa) — 0 = auto (1500·CBR)',pf.MrSub,v=>pf.MrSub=v);
    addField(g2,'Mr base granular (MPa)',pf.MrBase,v=>pf.MrBase=v);
    addField(g2,'Mr subbase granular (MPa)',pf.MrSubb,v=>pf.MrSubb=v);
    addField(g2,'a₁ — Coef. capa 1 (AC)',pf.capas[0].a,v=>pf.capas[0].a=v);
    addField(g2,'a₂ — Coef. capa 2 (base)',pf.capas[1].a,v=>pf.capas[1].a=v);
    addField(g2,'a₃ — Coef. capa 3 (subbase)',pf.capas[2].a,v=>pf.capas[2].a=v);
    addField(g2,'m₁ — Coef. drenaje capa 1',pf.capas[0].m,v=>pf.capas[0].m=v);
    addField(g2,'m₂ — Coef. drenaje capa 2',pf.capas[1].m,v=>pf.capas[1].m=v);
    addField(g2,'m₃ — Coef. drenaje capa 3',pf.capas[2].m,v=>pf.capas[2].m=v);
    fbox.innerHTML=`<h4>Ecuación AASHTO-93 — Pavimento Flexible (análisis por capas)</h4>
<p>log(W18) = ZR·So + 9.36·log(SN+1) − 0.20 + log(ΔPSI/2.7) / [0.40 + 1094/(SN+1)⁵·¹⁹] + 2.32·log(Mr) − 8.07<br>
ΔPSI = p₀ − pt · SN₁ con Mr de la base, SN₂ con Mr de la subbase, SN₃ con Mr de la subrasante.<br>
D₁ ≥ SN₁/(a₁m₁) · D₂ ≥ (SN₂ − SN₁*)/(a₂m₂) · D₃ ≥ (SN₃ − SN₁* − SN₂*)/(a₃m₃) (SN* = aporte provisto).</p>`;
  }else{
    const g2=addGroup(root,'Subrasante y concreto (rígido)');
    addField(g2,'CBR de subrasante (%)',sub.cbr,v=>sub.cbr=v);
    addField(g2,'k (MN/m³) — 0 = auto desde CBR',pr.k,v=>pr.k=v);
    addField(g2,'Ec — Módulo elástico concreto (MPa)',pr.Ec,v=>pr.Ec=v);
    addField(g2,'Sc — Módulo de rotura (MPa)',pr.Sc,v=>pr.Sc=v);
    addField(g2,'J — Coef. transferencia de carga',pr.J,v=>pr.J=v);
    addField(g2,'Cd — Coef. drenaje',pr.Cd,v=>pr.Cd=v);
    addField(g2,'Espesor de base (mm)',pr.D_base,v=>pr.D_base=v);
    fbox.innerHTML=`<h4>Ecuación AASHTO-93 — Pavimento Rígido</h4>
<p>log(W18) = ZR·So + 7.35·log(D+1) − 0.06 + log(ΔPSI/3.0) / [1 + 1.624×10⁷/(D+1)⁸·⁴⁶] + (4.22 − 0.32·pt)·log[ Sc·Cd·(D⁰·⁷⁵−1.132) / (215.63·J·(D⁰·⁷⁵ − 18.42/(Ec/k)⁰·²⁵)) ]<br>
ΔPSI = p₀ − pt. Use en k el valor compuesto (subrasante + base) si dispone de él.</p>`;
  }

  const g3=addGroup(root,'Instalación del geotextil (M288)');
  addField(g3,'Condiciones de instalación',sub.condiciones,v=>sub.condiciones=v,
    {options:[['leves','Leves (subrasante preparada, equipo liviano)'],['moderadas','Moderadas'],['severas','Severas (tocones, equipo pesado, subrasante irregular)']]});
  addField(g3,'Espesor 1ª capa granular sobre geotextil (mm)',sub.lift,v=>sub.lift=v);

  renderTransitoParams();renderVehiculosGrid();actualizarESALreadout();
}
function renderTransitoParams(){
  const grid=document.getElementById('transito-grid');grid.innerHTML='';
  addField(grid,'Tasa de crecimiento anual (%)',transito.crec,v=>transito.crec=v);
  addField(grid,'Período de diseño (años)',transito.anios,v=>transito.anios=v);
  addField(grid,'Factor direccional',transito.dir,v=>transito.dir=v);
  addField(grid,'Factor de carril de diseño',transito.carril,v=>transito.carril=v);
}
function renderVehiculosGrid(){
  const tipos=[['bus','Bus'],['c2','C2'],['c3','C3'],['c4','C4'],['c5','C5'],['c6','C6']];
  const fill=(id,obj,step,intOnly)=>{
    const grid=document.getElementById(id);grid.innerHTML='';
    tipos.forEach(([k,lab])=>{
      const d=document.createElement('div');d.className='param-row';
      d.innerHTML=`<label>${lab}</label><input type="number" value="${obj[k]}" step="${step}" min="0">`;
      grid.appendChild(d);
      d.querySelector('input').addEventListener('change',e=>{
        const v=intOnly?parseInt(e.target.value):parseFloat(e.target.value);
        obj[k]=isNaN(v)?0:v;marcarSucio();
      });
    });
  };
  fill('vehiculos-grid',vehiculos,1,true);
  fill('factoresF-grid',factoresF,0.01,false);
  fill('factoresR-grid',factoresR,0.01,false);
}

/* ================================================================
   CÁLCULOS PRINCIPALES
================================================================ */
function calcular(){
  const P=(tipo==='flexible')?pf:pr;
  if(metodo==='transito'){
    pf.W18=esalDesdeTransito(factoresF);
    pr.W18=esalDesdeTransito(factoresR);
    setStatus('ESAL calculado desde tránsito: '+P.W18.toExponential(2),'info');
  }
  if(!(P.W18>0)||!(sub.cbr>0)||!(P.R>=50&&P.R<100)){
    setStatus('❌ Revise W18 > 0, CBR > 0 y 50 ≤ R < 100.','err');return;
  }
  if(tipo==='flexible')calcularFlexible();else calcularRigido();
  calculado=true;dirty=false;renderQuick();
  if(document.getElementById('results-panel').style.display==='block')renderResults();
  if(document.getElementById('m288-panel').style.display==='block')renderM288();
  if(P.warn.length)setStatus('⚠ Cálculo completado con advertencias (ver Resultados).','warn');
  else setStatus('✅ Cálculo completado.','ok');
}

function flexLog(SN,ZR,So,dPSI,MrPsi){
  return ZR*So+9.36*Math.log10(SN+1)-0.20+Math.log10(dPSI/2.7)/(0.40+1094/Math.pow(SN+1,5.19))+2.32*Math.log10(MrPsi)-8.07;
}

function calcularFlexible(){
  pf.warn=[];
  const ZR=getZR(pf.R),dPSI=pf.p0-pf.pt,logW=Math.log10(pf.W18);
  if(!(dPSI>0)){pf.warn.push('ΔPSI = p₀ − pt debe ser positivo.');return;}
  const MrSubMPa=pf.MrSub>0?pf.MrSub:MrDesdeCBR_psi(sub.cbr)/145.038;
  pf.MrSubUsado=MrSubMPa;
  if(pf.MrSub<=0&&sub.cbr>10)pf.warn.push('CBR > 10: Mr = 1500·CBR no es válido; se extrapoló. Use un Mr medido.');
  if(MrSubMPa>=pf.MrSubb)pf.warn.push('El Mr de la subrasante es ≥ al de la subbase: la subbase no aporta soporte (revise datos).');
  if(pf.MrSubb>=pf.MrBase)pf.warn.push('El Mr de la subbase es ≥ al de la base (revise datos).');

  const snPara=(MrMPa,nombre)=>{
    const r=bisect(sn=>flexLog(sn,ZR,pf.So,dPSI,MrMPa*145.038)-logW,0.1,25);
    if(r.estado==='max')pf.warn.push(`No se alcanza convergencia para ${nombre}: W18 demasiado alto o Mr demasiado bajo (SN > 25).`);
    if(r.estado==='min')pf.warn.push(`${nombre}: el SN mínimo (0.1) ya satisface el tránsito.`);
    return r.x;
  };
  const SN1=snPara(pf.MrBase,'SN₁ (apoyo en base)');
  const SN2=snPara(pf.MrSubb,'SN₂ (apoyo en subbase)');
  const SN3=snPara(MrSubMPa,'SN₃ (apoyo en subrasante)');
  pf.SNs=[SN1,SN2,SN3];pf.SN_req=SN3;

  const [a1,a2,a3]=pf.capas.map(c=>c.a),[m1,m2,m3]=pf.capas.map(c=>c.m);
  const [minAC,minBase]=minimosAASHTO(pf.W18);pf.mins=[minAC,minBase];

  const D1=Math.max(minAC,ceil5(SN1/(a1*m1)*25.4));
  const SN1p=a1*m1*D1/25.4;
  const D2=Math.max(minBase,ceil5(Math.max(0,SN2-SN1p)/(a2*m2)*25.4));
  const SN2p=a2*m2*D2/25.4;
  const D3=Math.max(100,ceil5(Math.max(0,SN3-SN1p-SN2p)/(a3*m3)*25.4));
  pf.capas[0].D=D1;pf.capas[1].D=D2;pf.capas[2].D=D3;
  pf.SN_prov=parseFloat((SN1p+SN2p+a3*m3*D3/25.4).toFixed(3));
  if(pf.SN_prov+1e-6<SN3)pf.warn.push('El SN provisto es menor que el requerido (revise coeficientes).');
}

function rigLog(D,ZR,P,dPSI,Sc,Ec,k){
  const x=Math.pow(D,0.75);
  const inner=P.Cd*Sc*(x-1.132)/(215.63*P.J*(x-18.42/Math.pow(Ec/k,0.25)));
  if(!(inner>0))return -Infinity;
  return ZR*P.So+7.35*Math.log10(D+1)-0.06+Math.log10(dPSI/3.0)/(1+1.624e7/Math.pow(D+1,8.46))+(4.22-0.32*P.pt)*Math.log10(inner);
}

function calcularRigido(){
  pr.warn=[];
  const ZR=getZR(pr.R),dPSI=pr.p0-pr.pt,logW=Math.log10(pr.W18);
  if(!(dPSI>0)){pr.warn.push('ΔPSI = p₀ − pt debe ser positivo.');return;}
  const kMPa=pr.k>0?pr.k:kDesdeCBR(sub.cbr);
  pr.kUsado=kMPa;
  if(pr.k<=0&&sub.cbr<2)pr.warn.push('CBR muy bajo: la correlación k–CBR es poco confiable; mida k en campo.');
  const Sc=pr.Sc*145.038,Ec=pr.Ec*145.038,k=kMPa*3.6839;
  const r=bisect(D=>rigLog(D,ZR,pr,dPSI,Sc,Ec,k)-logW,4,24);
  if(r.estado==='max')pr.warn.push('No se alcanza convergencia: D > 24 in. Revise W18, Sc, J y k.');
  if(r.estado==='min')pr.warn.push('El espesor mínimo (4 in) ya satisface el tránsito; se adopta un mínimo constructivo de 150 mm.');
  pr.D_losa=Math.max(150,ceil5(r.x*25.4));
  pr.warn.push('El espesor de base no interviene en la ecuación: debe estar incluido en el valor de k.');
}

/* ================================================================
   RENDER RESULTADOS
================================================================ */
function renderWarnings(P){
  return P.warn.length?`<div class="warn-list"><strong>Advertencias:</strong><ul>${P.warn.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:'';
}
function renderResults(){
  const grid=document.getElementById('res-grid'),tbl=document.getElementById('capas-table'),sugDiv=document.getElementById('sugerencia-resultado');
  document.getElementById('res-title').textContent='Resultados — '+tipo+(metodo==='transito'?' (desde tránsito)':'');
  const s=obtenerSugerencia();
  const P=(tipo==='flexible')?pf:pr;
  document.getElementById('warnings-resultado').innerHTML=renderWarnings(P);

  if(tipo==='flexible'){
    grid.innerHTML=`
      <div class="res-card"><div class="lbl">W18 (ESAL)</div><div class="val">${pf.W18.toExponential(2)}</div></div>
      <div class="res-card"><div class="lbl">Confiabilidad</div><div class="val">${pf.R}%</div></div>
      <div class="res-card"><div class="lbl">CBR subrasante</div><div class="val">${sub.cbr}</div></div>
      <div class="res-card"><div class="lbl">Mr subrasante</div><div class="val">${pf.MrSubUsado.toFixed(1)} MPa</div></div>
      <div class="res-card"><div class="lbl">SN₁ / SN₂ / SN₃</div><div class="val" style="font-size:13px">${pf.SNs.map(x=>x.toFixed(2)).join(' / ')}</div></div>
      <div class="res-card"><div class="lbl">SN requerido (total)</div><div class="val">${pf.SN_req.toFixed(3)}</div></div>
      <div class="res-card"><div class="lbl">SN provisto</div><div class="val highlight">${pf.SN_prov.toFixed(3)}</div></div>`;
    tbl.innerHTML=`
      <tr><th>Capa</th><th>a</th><th>m</th><th>Mín. AASHTO</th><th>Espesor</th><th>in</th><th>Aporte SN</th></tr>
      ${pf.capas.map((c,i)=>`<tr><td><span class="swatch" style="background:${c.col}"></span>${c.nom}</td><td>${c.a}</td><td>${c.m}</td><td>${i===0?pf.mins[0]+' mm':i===1?pf.mins[1]+' mm':'100 mm (práctico)'}</td><td class="val-mm">${c.D} mm</td><td class="val-in">${(c.D/25.4).toFixed(2)}</td><td>${(c.a*c.m*(c.D/25.4)).toFixed(3)}</td></tr>`).join('')}
      <tr style="background:rgba(59,130,246,0.05)"><td colspan="6" style="text-align:right;font-weight:600">SN total provisto</td><td style="color:var(--green);font-weight:600">${pf.SN_prov.toFixed(3)}</td></tr>`;
  }else{
    grid.innerHTML=`
      <div class="res-card"><div class="lbl">W18 (ESAL)</div><div class="val">${pr.W18.toExponential(2)}</div></div>
      <div class="res-card"><div class="lbl">Confiabilidad</div><div class="val">${pr.R}%</div></div>
      <div class="res-card"><div class="lbl">Ec concreto</div><div class="val">${pr.Ec} MPa</div></div>
      <div class="res-card"><div class="lbl">CBR subrasante</div><div class="val">${sub.cbr}</div></div>
      <div class="res-card"><div class="lbl">k usado</div><div class="val">${pr.kUsado.toFixed(1)} MN/m³</div></div>
      <div class="res-card"><div class="lbl">ΔPSI</div><div class="val">${(pr.p0-pr.pt).toFixed(2)}</div><div class="sub">pt = ${pr.pt}</div></div>
      <div class="res-card"><div class="lbl">D losa</div><div class="val highlight">${pr.D_losa} mm</div><div class="sub">${(pr.D_losa/25.4).toFixed(2)} in</div></div>
      <div class="res-card"><div class="lbl">D base</div><div class="val">${pr.D_base} mm</div></div>`;
    tbl.innerHTML=`
      <tr><th>Capa</th><th>Descripción</th><th>Espesor (mm)</th><th>in</th><th>Parámetro</th></tr>
      <tr><td><span class="swatch" style="background:#9ca3af"></span>Losa</td><td>Concreto hidráulico</td><td class="val-mm">${pr.D_losa} mm</td><td class="val-in">${(pr.D_losa/25.4).toFixed(2)}</td><td>Ec = ${pr.Ec} MPa · Sc = ${pr.Sc} MPa</td></tr>
      <tr><td><span class="swatch" style="background:#8b6f3a"></span>Base</td><td>Base granular</td><td class="val-mm">${pr.D_base} mm</td><td class="val-in">${(pr.D_base/25.4).toFixed(2)}</td><td>k = ${pr.kUsado.toFixed(1)} MN/m³</td></tr>
      <tr style="background:rgba(59,130,246,0.05)"><td colspan="4" style="text-align:right;font-weight:600">Subrasante</td><td style="color:var(--text2);">CBR = ${sub.cbr}</td></tr>`;
  }

  sugDiv.innerHTML=`
    <div style="background:${s.color}12;border-left:4px solid ${s.color};padding:16px 18px;border-radius:8px;">
      <div style="color:${s.color};font-weight:600;font-size:13px;margin-bottom:8px;font-family:var(--mono);">${s.emoji} ${s.titulo}</div>
      <div style="color:var(--text);font-size:11px;line-height:1.7;margin-bottom:10px;">${s.resumen}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px;">
        <div style="background:rgba(15,94,168,0.07);border-radius:6px;padding:8px 10px;"><div style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;">Aplicación</div><div style="font-family:var(--mono);font-size:12px;font-weight:600;color:${s.color};">${s.app.label}</div></div>
        <div style="background:rgba(15,94,168,0.07);border-radius:6px;padding:8px 10px;"><div style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;">Clase Geotextil</div><div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text);">${s.claseSeleccionada}</div></div>
        <div style="background:rgba(15,94,168,0.07);border-radius:6px;padding:8px 10px;"><div style="font-family:var(--mono);font-size:9px;color:var(--text3);text-transform:uppercase;">Traslape mín.</div><div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text);">${s.traslape}</div></div>
      </div>
      <div style="margin-top:12px;font-size:10px;color:var(--text3);font-family:var(--mono);">→ Abra el panel <strong style="color:var(--accent2)">🧵 Geotextiles M288</strong> para la especificación completa.</div>
    </div>`;
}

/* ================================================================
   INFORME TÉCNICO
================================================================ */
const LOGO_URL=new URL('logo-comfenalco.png',location.href).href;
function generarInforme(){
  if(!calculado){setStatus('⚠️ Primero presione Calcular para generar el informe.','err');return;}
  const s=obtenerSugerencia();
  const P=(tipo==='flexible')?pf:pr;
  const fecha=new Date().toLocaleString('es-CO',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const t1=s.especifClase;
  let resultadosHTML='',contenidoCapas='',formulaHTML='',recomendaciones='';

  if(tipo==='flexible'){
    resultadosHTML=`
      <tr><td><strong>W18 (ESAL)</strong></td><td>${pf.W18.toExponential(4)}</td></tr>
      <tr><td><strong>Confiabilidad (R)</strong></td><td>${pf.R}%</td></tr>
      <tr><td><strong>Desviación estándar (So)</strong></td><td>${pf.So}</td></tr>
      <tr><td><strong>p₀ / pt / ΔPSI</strong></td><td>${pf.p0} / ${pf.pt} / ${(pf.p0-pf.pt).toFixed(2)}</td></tr>
      <tr><td><strong>CBR subrasante</strong></td><td>${sub.cbr}</td></tr>
      <tr><td><strong>Mr subrasante</strong></td><td>${pf.MrSubUsado.toFixed(1)} MPa</td></tr>
      <tr><td><strong>Mr base / subbase</strong></td><td>${pf.MrBase} / ${pf.MrSubb} MPa</td></tr>
      <tr><td><strong>SN₁ / SN₂ / SN₃ requeridos</strong></td><td>${pf.SNs.map(x=>x.toFixed(3)).join(' / ')}</td></tr>
      <tr><td><strong>SN provisto</strong></td><td>${pf.SN_prov.toFixed(3)}</td></tr>`;
    contenidoCapas=`
      <table class="info-table"><thead><tr><th>Capa</th><th>Coef. a</th><th>Coef. m</th><th>Espesor (mm)</th><th>Espesor (in)</th><th>Aporte SN</th></tr></thead><tbody>
        ${pf.capas.map(c=>`<tr><td>${c.nom}</td><td>${c.a}</td><td>${c.m}</td><td>${c.D}</td><td>${(c.D/25.4).toFixed(2)}</td><td>${(c.a*c.m*(c.D/25.4)).toFixed(3)}</td></tr>`).join('')}
        <tr style="font-weight:bold;background:#f0f0f0;"><td colspan="5" style="text-align:right;">SN TOTAL PROVISTO</td><td>${pf.SN_prov.toFixed(3)}</td></tr>
      </tbody></table>`;
    formulaHTML=`<p><strong>Ecuación AASHTO-93 para pavimento flexible (análisis por capas):</strong></p>
      <p class="formula">log(W18) = ZR·So + 9.36·log(SN+1) − 0.20 + log(ΔPSI/2.7) / [0.40 + 1094/(SN+1)⁵·¹⁹] + 2.32·log(Mr) − 8.07</p>
      <p>Se calcula SN₁, SN₂ y SN₃ con el módulo resiliente de la base, la subbase y la subrasante respectivamente, y los espesores se obtienen con D₁ ≥ SN₁/(a₁m₁), D₂ ≥ (SN₂−SN₁*)/(a₂m₂), D₃ ≥ (SN₃−SN₁*−SN₂*)/(a₃m₃), respetando los espesores mínimos AASHTO por nivel de tránsito (carpeta ${pf.mins[0]} mm, base ${pf.mins[1]} mm).</p>`;
    recomendaciones=`<p>Estructura propuesta: carpeta asfáltica de <strong>${pf.capas[0].D} mm</strong>, base granular de <strong>${pf.capas[1].D} mm</strong> y subbase granular de <strong>${pf.capas[2].D} mm</strong> (SN provisto ${pf.SN_prov.toFixed(2)} ≥ SN requerido ${pf.SN_req.toFixed(2)}).</p>`;
  }else{
    resultadosHTML=`
      <tr><td><strong>W18 (ESAL)</strong></td><td>${pr.W18.toExponential(4)}</td></tr>
      <tr><td><strong>Confiabilidad (R)</strong></td><td>${pr.R}%</td></tr>
      <tr><td><strong>Desviación estándar (So)</strong></td><td>${pr.So}</td></tr>
      <tr><td><strong>p₀ / pt / ΔPSI</strong></td><td>${pr.p0} / ${pr.pt} / ${(pr.p0-pr.pt).toFixed(2)}</td></tr>
      <tr><td><strong>Ec concreto</strong></td><td>${pr.Ec} MPa</td></tr>
      <tr><td><strong>Sc (módulo de rotura)</strong></td><td>${pr.Sc} MPa</td></tr>
      <tr><td><strong>CBR subrasante</strong></td><td>${sub.cbr}</td></tr>
      <tr><td><strong>k usado</strong></td><td>${pr.kUsado.toFixed(1)} MN/m³</td></tr>
      <tr><td><strong>J (transferencia)</strong></td><td>${pr.J}</td></tr>
      <tr><td><strong>Cd (drenaje)</strong></td><td>${pr.Cd}</td></tr>
      <tr><td><strong>Espesor de losa (D)</strong></td><td>${pr.D_losa} mm (${(pr.D_losa/25.4).toFixed(2)} in)</td></tr>
      <tr><td><strong>Espesor de base</strong></td><td>${pr.D_base} mm</td></tr>`;
    contenidoCapas=`
      <table class="info-table"><thead><tr><th>Capa</th><th>Descripción</th><th>Espesor (mm)</th><th>Espesor (in)</th><th>Parámetro</th></tr></thead><tbody>
        <tr><td>Losa</td><td>Concreto hidráulico</td><td>${pr.D_losa}</td><td>${(pr.D_losa/25.4).toFixed(2)}</td><td>Ec = ${pr.Ec} MPa</td></tr>
        <tr><td>Base</td><td>Base granular</td><td>${pr.D_base}</td><td>${(pr.D_base/25.4).toFixed(2)}</td><td>k = ${pr.kUsado.toFixed(1)} MN/m³</td></tr>
        <tr style="font-weight:bold;background:#f0f0f0;"><td colspan="4" style="text-align:right;">Subrasante</td><td>CBR = ${sub.cbr}</td></tr>
      </tbody></table>`;
    formulaHTML=`<p><strong>Ecuación AASHTO-93 para pavimento rígido:</strong></p>
      <p class="formula">log(W18) = ZR·So + 7.35·log(D+1) − 0.06 + log(ΔPSI/3.0) / [1 + 1.624×10⁷/(D+1)⁸·⁴⁶] + (4.22 − 0.32·pt)·log[ Sc·Cd·(D⁰·⁷⁵−1.132) / (215.63·J·(D⁰·⁷⁵ − 18.42/(Ec/k)⁰·²⁵)) ]</p>`;
    recomendaciones=`<p>Estructura propuesta: losa de concreto de <strong>${pr.D_losa} mm</strong> sobre base granular de <strong>${pr.D_base} mm</strong>, con J = ${pr.J} y Cd = ${pr.Cd}.</p>`;
  }

  let metodoTransitoHTML;
  if(metodo==='transito'){
    const total=Object.values(vehiculos).reduce((a,b)=>a+b,0);
    const fac=tipo==='flexible'?factoresF:factoresR;
    const nombres={bus:'Bus',c2:'C2',c3:'C3',c4:'C4',c5:'C5',c6:'C6'};
    metodoTransitoHTML=`<h2>4. Metodología de Tránsito</h2>
      <table class="info-table"><thead><tr><th>Vehículo</th><th>TPD</th><th>Factor de daño</th></tr></thead><tbody>
        ${Object.keys(vehiculos).map(k=>`<tr><td>${nombres[k]}</td><td>${vehiculos[k]}</td><td>${fac[k]}</td></tr>`).join('')}
        <tr style="font-weight:bold;background:#f0f0f0;"><td>Total</td><td>${total}</td><td>—</td></tr>
      </tbody></table>
      <table class="info-table"><thead><tr><th>Parámetro</th><th>Valor</th></tr></thead><tbody>
        <tr><td>Tasa de crecimiento anual</td><td>${transito.crec}%</td></tr>
        <tr><td>Período de diseño</td><td>${transito.anios} años</td></tr>
        <tr><td>Factor direccional</td><td>${transito.dir}</td></tr>
        <tr><td>Factor de carril</td><td>${transito.carril}</td></tr>
        <tr style="font-weight:bold;background:#f0f0f0;"><td>W18 calculado</td><td>${P.W18.toExponential(4)}</td></tr>
      </tbody></table>
      <p class="formula">W18 = Σ(TPDᵢ × FDᵢ) × 365 × F_dir × F_carril × [(1+i)ⁿ − 1] / i</p>`;
  }else{
    metodoTransitoHTML=`<h2>4. Metodología de Tránsito</h2><p>El valor de W18 fue ingresado directamente:</p><p class="formula">W18 = ${P.W18.toExponential(4)} ESAL</p>`;
  }

  const warnHTML=P.warn.length?`<h3>Advertencias del cálculo</h3><ul>${P.warn.map(w=>`<li>${w}</li>`).join('')}</ul>`:'';

  const bloqueM288=`
    <h2>7. Especificación de Geosintéticos — AASHTO M288-00</h2>
    <p>Con CBR de subrasante = <strong>${s.cbr.toFixed(2)}</strong>, condiciones de instalación <strong>${sub.condiciones}</strong> y primera capa granular de <strong>${sub.lift} mm</strong>, se selecciona:</p>
    <div class="sugerencia-box" style="border-left-color:${s.color};background:${s.color}12;">
      <div class="titulo" style="color:${s.color};">${s.titulo}</div>
      <div class="subtitulo">${s.app.tabla.ref}</div>
      <div class="detalle">${s.resumen}</div>
    </div>
    ${s.motivos.length?`<ul>${s.motivos.map(m=>`<li>${m}</li>`).join('')}</ul>`:''}
    ${s.advertencias.length?`<ul>${s.advertencias.map(m=>`<li><strong>${m}</strong></li>`).join('')}</ul>`:''}
    <h3>7.1. Requerimientos de Resistencia (Tabla 1 — ${s.claseSeleccionada})</h3>
    <table class="info-table"><thead><tr><th>Propiedad</th><th>Método</th><th>Elong &lt; 50%</th><th>Elong ≥ 50%</th></tr></thead><tbody>
      <tr><td>Resistencia Grab</td><td>ASTM D4632</td><td>${t1.elong_menor_50.grab} N</td><td>${t1.elong_mayor_50.grab} N</td></tr>
      <tr><td>Resistencia Costura</td><td>ASTM D4632</td><td>${t1.elong_menor_50.costura} N</td><td>${t1.elong_mayor_50.costura} N</td></tr>
      <tr><td>Resistencia al Rasgado</td><td>ASTM D4533</td><td>${t1.elong_menor_50.rasgado} N</td><td>${t1.elong_mayor_50.rasgado} N</td></tr>
      <tr><td>Resistencia al Punzonado</td><td>ASTM D4833</td><td>${t1.elong_menor_50.punzonado} N</td><td>${t1.elong_mayor_50.punzonado} N</td></tr>
    </tbody></table>
    <h3>7.2. Requerimientos de Filtración — ${s.app.tabla.titulo}</h3>
    <table class="info-table"><thead><tr><th>Propiedad</th><th>Método</th><th>Valor requerido</th></tr></thead><tbody>${s.requerimientosApp.replace(/class="[^"]*"/g,'')}</tbody></table>
    <h3>7.3. Traslapes mínimos (Tabla A1)</h3>
    <table class="info-table"><thead><tr><th>CBR del suelo</th><th>Traslape mínimo</th></tr></thead><tbody>${M288.tablaA1.map(r=>`<tr><td>${r.condicion}</td><td>${r.traslape}</td></tr>`).join('')}</tbody></table>
    <p><strong>Traslape aplicable a este proyecto:</strong> <span style="color:${s.color};font-weight:600;">${s.traslape}</span></p>
    <h3>7.4. Notas normativas</h3>
    <ul>${s.app.tabla.notas.map(n=>`<li>${n}</li>`).join('')}</ul>
    <p style="font-size:11px;color:#64748b;">Se empleó la edición M288-00; existen ediciones posteriores (M288-06, M288-17).</p>`;

  const informeHTML=`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Informe Técnico — Diseño de Pavimento AASHTO-93 + M288-00</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'IBM Plex Sans',sans-serif;background:#fff;color:#1a1a1a;line-height:1.7;padding:40px;max-width:900px;margin:0 auto}
  .header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:20px;margin-bottom:30px}
  .header .institution{font-size:12px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
  .header h1{font-size:24px;font-weight:700;color:#1e3a8a;margin-bottom:6px}
  .header .subtitle{font-size:14px;color:#475569;margin-bottom:12px}
  .header .meta{font-size:11px;color:#64748b;font-family:'IBM Plex Mono',monospace}
  h2{font-size:16px;font-weight:700;color:#1e3a8a;margin-top:30px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #dbeafe}
  h3{font-size:13px;font-weight:600;color:#334155;margin-top:18px;margin-bottom:8px}
  p{margin-bottom:10px;font-size:13px}
  ul{margin-left:20px;margin-bottom:10px} li{font-size:12px;margin-bottom:4px}
  .info-table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0}
  .info-table th{background:#1e40af;color:#fff;padding:8px 12px;text-align:left;font-weight:600;font-size:11px}
  .info-table td{padding:7px 12px;border-bottom:1px solid #e2e8f0}
  .info-table tr:nth-child(even){background:#f8fafc}
  .formula{background:#f1f5f9;border-left:3px solid #3b82f6;padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:11px;margin:10px 0;overflow-x:auto}
  .sugerencia-box{padding:16px 20px;margin:16px 0;border-radius:4px;border-left:4px solid #3b82f6}
  .sugerencia-box .titulo{font-size:14px;font-weight:700;margin-bottom:8px}
  .sugerencia-box .subtitulo{font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:8px}
  .sugerencia-box .detalle{font-size:11px;color:#475569;line-height:1.7}
  .firma{margin-top:50px;display:flex;justify-content:space-around}
  .firma div{text-align:center;width:200px}
  .firma .linea{border-top:1px solid #1a1a1a;margin-bottom:6px;padding-top:40px}
  .firma .nombre{font-size:11px;font-weight:600}
  .firma .cargo{font-size:10px;color:#64748b}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  .print-btn{position:fixed;top:20px;right:20px;background:#1e40af;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(30,64,175,.3)}
  @media print{.print-btn{display:none}body{padding:20px}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ IMPRIMIR / PDF</button>
<div class="header">
  <img src="${LOGO_URL}" alt="Tecnológico Comfenalco" style="height:74px;margin-bottom:8px">
  <div class="institution">Fundación Universitaria Tecnológico Comfenalco</div>
  <h1>INFORME TÉCNICO DE DISEÑO DE PAVIMENTO</h1>
  <div class="subtitle">Método AASHTO-93 · Pavimento ${tipo==='flexible'?'Flexible':'Rígido'} · Geosintéticos AASHTO M288-00</div>
  <div class="meta">Generado: ${fecha}</div>
</div>
<h2>1. Introducción</h2>
<p>El presente informe documenta el diseño de la estructura de pavimento ${tipo==='flexible'?'flexible':'rígido'} mediante el método AASHTO-93, complementado con la especificación de geosintéticos según <strong>AASHTO M288-00</strong> para separación/estabilización entre la subrasante y las capas granulares.</p>
<h2>2. Parámetros de Diseño</h2>
<table class="info-table"><thead><tr><th>Parámetro</th><th>Valor</th></tr></thead><tbody>${resultadosHTML}</tbody></table>
<h2>3. Metodología de Cálculo</h2>
${formulaHTML}
${metodoTransitoHTML}
<h2>5. Resultados del Diseño</h2>
${contenidoCapas}
${warnHTML}
<h2>6. Recomendaciones Técnicas</h2>
${recomendaciones}
${bloqueM288}
<h2>8. Referencias Normativas</h2>
<ul>
  <li><strong>AASHTO Guide for Design of Pavement Structures</strong>, 1993.</li>
  <li><strong>AASHTO M 288-00</strong> — Standard Specification for Geosynthetic Specification for Highway Applications.</li>
  <li><strong>ASTM D4632</strong> — Grab Breaking Load and Elongation of Geotextiles.</li>
  <li><strong>ASTM D4833</strong> — Index Puncture Resistance of Geomembranes.</li>
  <li><strong>ASTM D4533</strong> — Trapezoid Tearing Strength of Geotextiles.</li>
  <li><strong>ASTM D4491</strong> — Water Permeability of Geotextiles by Permittivity.</li>
  <li><strong>ASTM D4751</strong> — Apparent Opening Size of a Geotextile.</li>
  <li><strong>ASTM D4355</strong> — Deterioration of Geotextiles by Xenon-Arc Exposure.</li>
  <li><strong>ASTM D5261</strong> — Mass per Unit Area of Geotextiles.</li>
  <li><strong>ASTM D276</strong> — Identification of Fibers in Textiles.</li>
  <li><strong>ASTM D6140</strong> — Asphalt Retention of Paving Fabrics.</li>
</ul>
<div class="firma">
  <div><div class="linea"></div><div class="nombre">Ing. Responsable</div><div class="cargo">Diseñador de Pavimentos</div></div>
  <div><div class="linea"></div><div class="nombre">Revisor Técnico</div><div class="cargo">Supervisor de Diseño</div></div>
</div>
<div class="footer">Informe generado por el Sistema de Diseño AASHTO-93 v7.0 + M288-00<br>Fundación Universitaria Tecnológico Comfenalco · Solo uso académico</div>
</body></html>`;

  const ventana=window.open('','_blank');
  if(!ventana){setStatus('⚠️ El navegador bloqueó la ventana emergente. Permita pop-ups para ver el informe.','err');return;}
  ventana.document.write(informeHTML);
  ventana.document.close();
  setStatus('✅ Informe generado. Se abrió en nueva pestaña.','ok');
}

/* ================================================================
   EJEMPLOS
================================================================ */
function ejemploFlex(){
  setTipo('flexible');setMetodo('esal');renderQuick();
  pf.W18=5e6;pf.R=90;pf.So=0.45;pf.p0=4.2;pf.pt=2.5;pf.MrSub=0;pf.MrBase=200;pf.MrSubb=100;
  pf.capas[0].a=0.44;pf.capas[1].a=0.14;pf.capas[2].a=0.11;
  pf.capas.forEach(c=>c.m=1.0);
  sub.cbr=5;sub.condiciones='moderadas';sub.lift=200;
  calcular();
  document.getElementById('results-panel').style.display='block';
  renderResults();
}
function ejemploRig(){
  setTipo('rigido');setMetodo('esal');
  pr.W18=5e6;pr.R=90;pr.So=0.35;pr.p0=4.5;pr.pt=2.5;
  pr.Ec=27579;pr.Sc=4.5;pr.k=0;pr.J=3.2;pr.Cd=1.0;pr.D_base=150;
  sub.cbr=2.5;sub.condiciones='moderadas';sub.lift=150;
  calcular();
  document.getElementById('results-panel').style.display='block';
  renderResults();
}

/* ================================================================
   DIBUJO CANVAS (escena ampliada, capas proporcionales al espesor)
================================================================ */
function drawCloud(cx,cy,s,off){
  let x=cx+off;
  while(x>W+120)x-=W+240;
  while(x<-120)x+=W+240;
  ctx.save();ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x,cy,s,0,Math.PI*2);
  ctx.arc(x+s*0.8,cy-s*0.3,s*0.7,0,Math.PI*2);
  ctx.arc(x-s*0.8,cy-s*0.2,s*0.7,0,Math.PI*2);
  ctx.arc(x+s*0.4,cy+s*0.2,s*0.6,0,Math.PI*2);
  ctx.arc(x-s*0.4,cy+s*0.2,s*0.6,0,Math.PI*2);
  ctx.fill();ctx.restore();
}
function drawTree(x,base,h,w){
  ctx.fillStyle='#3a2a12';ctx.fillRect(x-w*0.08,base-h*0.25,w*0.16,h*0.3);
  ctx.fillStyle='#1e6b1e';ctx.beginPath();ctx.moveTo(x,base-h);ctx.lineTo(x-w/2,base-h*0.33);ctx.lineTo(x+w/2,base-h*0.33);ctx.closePath();ctx.fill();
  ctx.fillStyle='#28882a';ctx.beginPath();ctx.moveTo(x,base-h*1.05);ctx.lineTo(x-w*.4,base-h*0.55);ctx.lineTo(x+w*.4,base-h*0.55);ctx.closePath();ctx.fill();
  ctx.fillStyle='#1a5a1a';ctx.beginPath();ctx.moveTo(x,base-h*0.85);ctx.lineTo(x-w*.35,base-h*0.45);ctx.lineTo(x+w*.35,base-h*0.45);ctx.closePath();ctx.fill();
}
function drawVehicle(x,emoji,size,label){
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.28)';
  ctx.beginPath();ctx.ellipse(x,CY+2,size*0.5,5,0,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=10;ctx.shadowOffsetX=3;ctx.shadowOffsetY=3;
  ctx.font=size+'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillStyle='#fff';ctx.fillText(emoji,x,CY+size*0.12);
  ctx.restore();
  ctx.save();ctx.fillStyle='rgba(255,255,255,0.75)';
  ctx.font='bold 12px "IBM Plex Mono",monospace';ctx.textAlign='center';ctx.textBaseline='bottom';
  ctx.fillText(label,x,CY-size*0.95);ctx.restore();
}

function vehPos(speed,offset){ return W+220-((animT*speed+offset)%(W+440)); }

function drawScene(){
  /* cielo y montañas */
  const sky=ctx.createLinearGradient(0,0,0,CY);
  sky.addColorStop(0,'#0a1628');sky.addColorStop(0.5,'#1a3a5c');sky.addColorStop(1,'#2a5a7a');
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(20,50,80,0.85)';ctx.beginPath();
  ctx.moveTo(-50,CY+5);ctx.lineTo(W*0.28,CY-190);ctx.lineTo(W*0.5,CY-100);ctx.lineTo(W*0.74,CY-150);ctx.lineTo(W*0.9,CY-60);ctx.lineTo(W+50,CY+5);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(30,70,100,0.7)';ctx.beginPath();
  ctx.moveTo(-50,CY+5);ctx.lineTo(W*0.12,CY-110);ctx.lineTo(W*0.4,CY-50);ctx.lineTo(W*0.64,CY-95);ctx.lineTo(W*0.85,CY-25);ctx.lineTo(W+50,CY+5);ctx.closePath();ctx.fill();
  drawCloud(200,50,34,nubeOff);drawCloud(W-180,38,26,nubeOff*0.65);drawCloud(W/2+60,70,22,nubeOff*0.42+260);
  drawTree(40,CY,140,60);drawTree(120,CY,110,46);drawTree(W-60,CY,160,68);drawTree(W-140,CY,125,52);drawTree(W-215,CY,100,42);

  /* geometría de capas (proporcional al espesor) */
  let layers;
  if(tipo==='flexible'){
    const ds=calculado?pf.capas.map(c=>c.D):[150,200,180];
    layers=[
      {nom:'CARPETA ASFÁLTICA',color:'#26262b',mm:ds[0]},
      {nom:'BASE GRANULAR',color:'#7a5e30',mm:ds[1]},
      {nom:'SUBBASE GRANULAR',color:'#b08c55',mm:ds[2]}
    ];
  }else{
    layers=[
      {nom:'LOSA DE CONCRETO',color:'#8a8a82',mm:calculado?pr.D_losa:250},
      {nom:'BASE GRANULAR',color:'#7a5e30',mm:calculado?pr.D_base:150}
    ];
  }
  const total=layers.reduce((a,l)=>a+l.mm,0);
  const scale=Math.min(0.5,(H-CY-120)/total);
  layers.forEach(l=>l.h=Math.max(26,l.mm*scale));
  const ys=[CY];layers.forEach(l=>ys.push(ys[ys.length-1]+l.h));
  const n=layers.length;

  /* cargas móviles (para la deformación) */
  const busX=vehPos(2.4,0),truckX=vehPos(1.9,470),carX=vehPos(3.4,930);
  const loads=[{x:busX,w:0.7},{x:truckX,w:1},{x:carX,w:0.25}];
  function defl(x,k){
    if(k===0)return 0;
    const amp=12*Math.pow(0.68,k-1);
    let s=0;
    for(const L of loads){const dx=x-L.x;s+=L.w*Math.exp(-(dx*dx)/(2*60*60));}
    return amp*Math.min(1.2,s);
  }
  const yI=(x,k)=>ys[k]+defl(x,k);

  /* capas */
  layers.forEach((l,i)=>{
    ctx.fillStyle=l.color;ctx.beginPath();
    ctx.moveTo(0,yI(0,i));
    for(let x=0;x<=W;x+=4)ctx.lineTo(x,yI(x,i));
    for(let x=W;x>=0;x-=4)ctx.lineTo(x,yI(x,i+1));
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.04)';
    for(let xx=0;xx<W;xx+=10)ctx.fillRect(xx,ys[i],1,l.h);
    if(tipo==='rigido'&&i===0){
      ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;
      for(let jx=0;jx<=W;jx+=160){ctx.beginPath();ctx.moveTo(jx,ys[0]);ctx.lineTo(jx,ys[1]);ctx.stroke();}
    }
    ctx.fillStyle='rgba(255,255,255,0.88)';ctx.font='bold 13px "IBM Plex Mono",monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(`${l.nom}  ${l.mm} mm`,W/2,ys[i]+l.h/2);
  });

  /* subrasante */
  const s=obtenerSugerencia();
  ctx.fillStyle='#4a5a3a';ctx.beginPath();
  ctx.moveTo(0,yI(0,n));
  for(let x=0;x<=W;x+=4)ctx.lineTo(x,yI(x,n));
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.05)';
  for(let xx=0;xx<W;xx+=14)for(let yS=ys[n]+10;yS<H;yS+=10)ctx.fillRect(xx,yS,1,7);

  /* geotextil como línea sobre la subrasante */
  ctx.save();ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.setLineDash([12,7]);
  ctx.beginPath();ctx.moveTo(0,yI(0,n));for(let x=0;x<=W;x+=4)ctx.lineTo(x,yI(x,n));ctx.stroke();ctx.restore();

  const subH=H-ys[n];
  const W18m=((tipo==='flexible')?pf.W18:pr.W18)/1e6;
  const par=(tipo==='flexible')?`Mr = ${(calculado?pf.MrSubUsado:MrDesdeCBR_psi(sub.cbr)/145.038).toFixed(0)} MPa`:`k = ${(calculado?pr.kUsado:kDesdeCBR(sub.cbr)).toFixed(0)} MN/m³`;
  ctx.fillStyle='rgba(255,255,255,0.92)';ctx.font='bold 13px "IBM Plex Mono",monospace';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(`SUBRASANTE  (CBR = ${sub.cbr} | ${par} | W18 = ${W18m.toFixed(1)}M)`,W/2,ys[n]+subH*0.38);
  ctx.font='bold 12px "IBM Plex Mono",monospace';ctx.fillStyle=s.color;
  ctx.fillText(`${s.emoji} Geotextil ${s.claseSeleccionada} — ${s.app.label.split('(')[0].trim()}`,W/2,ys[n]+subH*0.68);

  /* superficie y vehículos (grandes, apoyados en la rasante) */
  ctx.fillStyle='#4b4b52';ctx.fillRect(0,CY-3,W,3);
  drawVehicle(busX,'🚌',150,'Bus');
  drawVehicle(truckX,'🚛',175,'Tractocamión');
  drawVehicle(carX,'🚗',110,'Auto');
}

function loop(){animT+=1;nubeOff=(nubeOff+0.45)%(W+240);drawScene();requestAnimationFrame(loop);}
loop();
setMetodo('esal');
