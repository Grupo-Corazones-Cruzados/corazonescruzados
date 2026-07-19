import fs from 'fs'; import os from 'os';
const cfg = JSON.parse(fs.readFileSync(os.homedir()+'/.railway/config.json','utf8'));
export const TOKEN = cfg.user.token;
export const PROJECT='9879300f-745e-4929-b9cb-3d6a03ce0117';
export const ENV='88a29f70-b9cf-466d-a531-7a79300d518b';
export async function gql(query, variables={}) {
  const r = await fetch('https://backboard.railway.com/graphql/v2', {
    method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${TOKEN}`},
    body: JSON.stringify({query, variables}) });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors.map(e=>e.message)));
  return j.data;
}
