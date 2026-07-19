import fs from 'fs';
import { gql, PROJECT, ENV } from './rw-tmp.mjs';
const SVC = fs.readFileSync(process.env.SCRATCH+'/cron_service_id.txt','utf8').trim();
const DONE=['SUCCESS','FAILED','CRASHED','REMOVED','SKIPPED'];
for (let i=0;i<40;i++){
  const d=await gql(`query($p:String!,$s:String!,$e:String!){ deployments(first:1, input:{projectId:$p,serviceId:$s,environmentId:$e}){ edges{ node{ status } } } }`,{p:PROJECT,s:SVC,e:ENV});
  const st=d.deployments.edges[0]?.node.status;
  console.log(`[${new Date().toISOString().slice(11,19)}] ${st}`);
  if (DONE.includes(st)) break;
  await new Promise(r=>setTimeout(r,15000));
}
const c = await gql(`query($id:String!){ project(id:$id){ services{ edges{ node{ id name
  serviceInstances{ edges{ node{ environmentId cronSchedule startCommand restartPolicyType watchPatterns } } } } } } } }`,{id:PROJECT});
for (const e of c.project.services.edges) {
  if (e.node.id!==SVC) continue;
  for (const si of e.node.serviceInstances.edges) {
    const i=si.node; if (i.environmentId!==ENV) continue;
    console.log(`\n· ${e.node.name}`);
    console.log(`    cron          : ${i.cronSchedule}`);
    console.log(`    startCommand  : ${i.startCommand}`);
    console.log(`    watchPatterns : ${JSON.stringify(i.watchPatterns)}`);
    console.log(`    restartPolicy : ${i.restartPolicyType}`);
  }
}
