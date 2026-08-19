import puppeteer from 'puppeteer';
const D='/tmp/claude-501/-Users-lfgonzalezm0-Documents-02-Clientes-Fernando-Gonz-lez-GCC-WORLD/dd2f227f-eb08-43a9-9f0b-1c7947ea8d65/scratchpad/';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage(); await p.setViewport({width:1600,height:1250,deviceScaleFactor:2});
let malos=0;
for(const s of ['el-proyecto','como-se-entra','tu-talento','como-se-crece']){
  await p.goto('http://localhost:3099/desarrollo-humano/'+s,{waitUntil:'networkidle2'});
  await p.evaluate(()=>document.fonts.ready); await new Promise(r=>setTimeout(r,700));
  const r=await p.evaluate(()=>({
    h1:document.querySelector('h1')?.textContent,
    temas:[...document.querySelectorAll('.tema-anima')].map(t=>({id:t.id,pasos:t.querySelectorAll('ol > li').length})),
    idx:[...document.querySelectorAll('aside[aria-label="Preguntas de esta sección"] a')].length,
    desb:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
  r.temas.forEach(t=>{ if(t.pasos>3) malos++; });
  console.log(`  ${s.padEnd(15)} h1:"${r.h1}" idx:${r.idx} ${r.temas.map(t=>`${t.id}:${t.pasos}`).join('  ')} desborde:${r.desb?'SÍ ✖':'no'}`);
}
console.log(`\n  temas con más de 3 pasos: ${malos} ${malos===0?'✔':'✖'}`);
// también las de clientes, que comparten el componente
for(const s of ['plataforma','videojuego','marketplace','democracia']){
  await p.goto('http://localhost:3099/clientes/'+s,{waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,500));
  const n=await p.evaluate(()=>[...document.querySelectorAll('.tema-anima')].map(t=>t.querySelectorAll('ol > li').length).join(','));
  console.log(`  clientes/${s.padEnd(12)} pasos por tema: ${n}`);
}
await p.setViewport({width:1600,height:1150,deviceScaleFactor:2});
for(const [u,f] of [['/desarrollo-humano','dh2-proyecto.png'],['/desarrollo-humano/como-se-entra','dh2-entra.png'],['/desarrollo-humano/tu-talento','dh2-talento.png'],['/desarrollo-humano/como-se-crece','dh2-crece.png']]){
  await p.goto('http://localhost:3099'+u,{waitUntil:'networkidle2'});
  await p.evaluate(()=>document.fonts.ready); await new Promise(r=>setTimeout(r,800));
  await p.screenshot({path:D+f});
}
await b.close();
