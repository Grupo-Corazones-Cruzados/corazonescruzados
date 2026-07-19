import fs from 'fs';
import { gql, ENV } from './rw-tmp.mjs';
const SVC = fs.readFileSync(process.env.SCRATCH+'/cron_service_id.txt','utf8').trim();
// El script se renombró a nightly-cron.mjs (ahora agrupa varios trabajos nocturnos).
await gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`,
  {s:SVC,e:ENV,i:{ startCommand:'node scripts/nightly-cron.mjs', watchPatterns:['scripts/nightly-cron.mjs'] }});
// Lección aprendida: sin redespliegue, la configuración nueva no toma efecto.
await gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, {s:SVC,e:ENV});
console.log('Servicio de cron actualizado a nightly-cron.mjs + redespliegue lanzado.');
