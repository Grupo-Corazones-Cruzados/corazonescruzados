import fs from 'fs';
import { gql, ENV } from './rw-tmp.mjs';
const SVC = fs.readFileSync(process.env.SCRATCH+'/cron_service_id.txt','utf8').trim();
await gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`,
  {s:SVC,e:ENV,i:{ cronSchedule:'0 6 * * *' }});
await gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, {s:SVC,e:ENV});
console.log('Horario restaurado a "0 6 * * *" (01:00 Ecuador) + redespliegue.');
