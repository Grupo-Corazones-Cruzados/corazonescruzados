import fs from 'fs';
import { gql, ENV } from './rw-tmp.mjs';
const SVC = fs.readFileSync(process.env.SCRATCH+'/cron_service_id.txt','utf8').trim();
// El servicio ya no es solo de Pensamientos: ejecuta todos los trabajos nocturnos.
await gql(`mutation($id:String!,$input:ServiceUpdateInput!){ serviceUpdate(id:$id, input:$input){ id name } }`,
  {id:SVC, input:{ name:'nightly-cron' }});
console.log('Servicio renombrado a "nightly-cron".');
// Prueba decisiva: cada 5 min (mínimo documentado) + redespliegue para que tome efecto.
await gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`,
  {s:SVC,e:ENV,i:{ cronSchedule:'*/5 * * * *' }});
await gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, {s:SVC,e:ENV});
console.log(`Ahora (UTC): ${new Date().toISOString().slice(11,19)} · cron de prueba "*/5 * * * *" + redespliegue.`);
