import {schedule} from './finance-core.mjs';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {getFirestore,doc,getDocFromServer,runTransaction,onSnapshot} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
const config={apiKey:'AIzaSyCfjcPvoYtww42RsBk6S00jbDPp7nvfEC4',authDomain:'reforma-campo.firebaseapp.com',projectId:'reforma-campo',storageBucket:'reforma-campo.firebasestorage.app',messagingSenderId:'531348775748',appId:'1:531348775748:web:5332faceee90bf00eaad11'};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
const legacyBuckets=['expenses','donations','income'];
const buckets=[...legacyBuckets,'banks','loans'],owner='itronicrioverde@gmail.com';
let stopped=[],cache={},saving=0;
const status=document.getElementById('cloud-status'),gate=document.getElementById('cloud-gate'),error=document.getElementById('cloud-error');
const empty=()=>({items:[],version:1});
const reference=b=>doc(db,'reforma',b);
const authorized=()=>auth.currentUser?.email===owner&&auth.currentUser?.emailVerified;
function showError(e){error.textContent=e?.code==='auth/popup-blocked'?'O navegador bloqueou a janela. Permita pop-ups para entrar.':e?.code==='permission-denied'?'Acesso negado pelo Firebase. Confira conta verificada da gestão e regras publicadas; as coleções banks/loans exigem as regras desta versão. Nenhuma regra foi reduzida.':e?.message||'Não foi possível conectar. Tente novamente.';}
function stateLabel(s){status.textContent=s;}
function accept(b,data){cache[b]=data;window.dispatchEvent(new CustomEvent('gp-cloud-'+b,{detail:data}));window.dispatchEvent(new Event('gp-cloud-change'));}
window.gpCloudFetch=async(url,options={})=>{
 try{
  if(!authorized())throw Error('Entre na conta da gestão para acessar os registros.');
  if(!navigator.onLine)throw Error('Sem internet. O lançamento não foi enviado. Mantenha o formulário aberto e tente novamente.');
  const b=url.split('/').pop();if(!buckets.includes(b))throw Error('Registro desconhecido.');
  let result;
  if(options.method==='PUT'){
   const next=JSON.parse(String(options.body));if(!Array.isArray(next.items)||next.items.length>2000)throw Error('Limite de registros atingido.');
   saving++;stateLabel('Salvando no banco…');
   try{result=await runTransaction(db,async tx=>{const snap=await tx.get(reference(b)),current=snap.exists()?snap.data():empty();if(current.version!==next.version)throw Error('Os dados mudaram em outro aparelho. Atualize a lista antes de salvar novamente.');const data={items:next.items,version:current.version+1};tx.set(reference(b),data);return data;});accept(b,result);}finally{saving--}
  }else{const snap=await getDocFromServer(reference(b));result=snap.exists()?snap.data():empty();cache[b]=result;}
  stateLabel('Conectado · dados salvos online');return new Response(JSON.stringify(result));
 }catch(e){stateLabel('Falha na conexão · confira o aviso');return new Response(JSON.stringify({error:e.message||'Não foi possível salvar no banco.'}),{status:409});}
};
window.gpExport=async()=>{try{const values=await Promise.all(buckets.map(async b=>{const r=await window.gpCloudFetch('/api/'+b),d=await r.json();if(!r.ok)throw Error(d.error);return [b,d];}));download({format:'greenpark-backup-v1',exportedAt:new Date().toISOString(),data:Object.fromEntries(values)});}catch(e){showError(e);alert(e.message)}};
function download(data){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='Green_Park_Backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function validate(data){
 const root=data?.data||data,out={};
 for(const b of buckets){const items=root[b]?.items??(!legacyBuckets.includes(b)?[]:undefined);if(!Array.isArray(items)||items.length>2000)throw Error('Backup inválido: faltam registros de '+b+'.');
  const seen=new Set();for(const i of items){if(!i||typeof i.id!=='string'||!i.id||seen.has(i.id)||typeof i.name!=='string'||!i.name.trim())throw Error('Backup com registros inválidos ou duplicados.');seen.add(i.id);
   const amount=n=>Number.isSafeInteger(n)&&n>=0;
   if(b==='loans'){schedule(i);if(!['simulation','contracted'].includes(i.status)||typeof i.bankId!=='string'||!i.payments||typeof i.payments!=='object'||Array.isArray(i.payments)||Object.entries(i.payments).some(([n,d])=>!/^\d+$/.test(n)||Number(n)<1||Number(n)>i.count||typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d))||(i.status==='simulation'&&Object.keys(i.payments).length))throw Error('Contrato inválido.');}
   if(b==='expenses'&&(!amount(i.estimate)||!amount(i.paid)||!(i.actual===null||amount(i.actual))||i.paid>(i.actual??0)))throw Error('Valores inválidos nas despesas.');
   if(b==='income'&&(!amount(i.amount)||i.amount===0))throw Error('Valor inválido em arrecadação.');
   if(b==='donations'&&(!(Number.isFinite(i.quantity)&&i.quantity>0)||typeof i.donor!=='string'||!(i.estimatedValue==null||amount(i.estimatedValue))))throw Error('Valor inválido nos itens recebidos.');
  }out[b]={items,version:1};
 }return out;
}
async function importData(data){
 const incoming=validate(data),counts=buckets.map(b=>incoming[b].items.length);
 if(!confirm('Importar '+counts[0]+' despesas, '+counts[1]+' itens e '+counts[2]+' arrecadações, '+counts[3]+' bancos e '+counts[4]+' operações? Registros novos serão somados; os que já existem serão preservados.'))return;
 if(!authorized()||!navigator.onLine)throw Error('Entre na conta da gestão e conecte à internet.');
 stateLabel('Importando registros…');
 const result=await runTransaction(db,async tx=>{
  const snaps=await Promise.all(buckets.map(b=>tx.get(reference(b))));
  const next=buckets.map((b,index)=>{const current=snaps[index].exists()?snaps[index].data():empty(),ids=new Set(current.items.map(i=>i.id));const added=incoming[b].items.filter(i=>!ids.has(i.id));const items=[...current.items,...added];if(items.length>2000)throw Error('Limite de registros excedido.');return {items,version:current.version+1}});
  buckets.forEach((b,i)=>tx.set(reference(b),next[i]));return next;
 });buckets.forEach((b,i)=>accept(b,result[i]));stateLabel('Importação concluída · dados salvos online');alert('Importação concluída. Os registros já estão no banco online.');
}
document.getElementById('cloud-login').onclick=async()=>{error.textContent='';try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){showError(e)}};
document.getElementById('cloud-logout').onclick=()=>signOut(auth);
document.getElementById('cloud-import').onclick=()=>document.getElementById('cloud-file').click();
document.getElementById('cloud-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error('Backup maior que 5 MB.');await importData(JSON.parse(await file.text()))}catch(e){showError(e);alert(e.message)}finally{e.target.value=''}};
document.getElementById('cloud-local').onclick=async()=>{try{const raw=localStorage.getItem('greenpark-reforma-html-v1');if(!raw)throw Error('Não há lançamentos locais neste navegador. Use Importar backup para trazer de outro aparelho.');await importData(JSON.parse(raw))}catch(e){showError(e);alert(e.message)}};
window.addEventListener('offline',()=>stateLabel('Sem internet · reconecte para salvar'));
window.addEventListener('online',()=>stateLabel('Reconectando ao banco…'));
onAuthStateChanged(auth,async user=>{
 stopped.forEach(fn=>fn());stopped=[];cache={};
 if(!user||!authorized()){gate.hidden=false;document.getElementById('app-shell').hidden=true;stateLabel('Entre para conectar ao banco');if(user)showError(Error('Acesso reservado a '+owner+'. Troque de conta.'));return}
 error.textContent='';gate.hidden=true;document.getElementById('app-shell').hidden=false;stateLabel('Conectando ao banco…');
 for(const b of buckets)stopped.push(onSnapshot(reference(b),{includeMetadataChanges:true},snap=>{if(snap.metadata.fromCache)return;accept(b,snap.exists()?snap.data():empty());if(!saving)stateLabel('Conectado · atualização automática')},e=>{showError(e);stateLabel('Falha ao sincronizar · atualize a página')}));
 if(!window.gpMounted){window.gpMounted=true;window.dispatchEvent(new Event('gp-start'));}
});
