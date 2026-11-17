// All monetary values are integer BRL cents. No rate below is presented as CET.
export const cardSimulation = Object.freeze({id:'illustrative-card',name:'Captação via cartão',status:'simulation',net:2500000,total:2820079,intermediation:61760,installmentFee:258319,intermediationRate:2.19,informedInstallmentRate:1.51,days:1,count:12});
export function dateAt(first, offset) {
 const [y,m,d]=first.split('-').map(Number), last=new Date(Date.UTC(y,m+offset,0));
 return new Date(Date.UTC(y,m-1+offset,Math.min(d,last.getUTCDate()))).toISOString().slice(0,10);
}
export function schedule(c) {
 for(const k of ['principal','net','iof','fees','insurance','other','monthlyCharge']) if(!Number.isSafeInteger(c[k])||c[k]<0||c[k]>1e11) throw Error('Valores monetários inválidos.');
 if(c.principal<=0||c.net<=0||c.net>c.principal||!Number.isInteger(c.count)||c.count<1||c.count>600||!Number.isFinite(c.rate)||c.rate<0||c.rate>100||!['Price','SAC'].includes(c.system)||!/^\d{4}-\d{2}-\d{2}$/.test(c.first)||!Number.isFinite(Date.parse(c.first))||new Date(c.first).toISOString().slice(0,10)!==c.first) throw Error('Confira valor, parcelas, taxa e vencimento.');
 const upfront=c.iof+c.fees+c.insurance+c.other;
 if(c.principal-upfront!==c.net) throw Error('Neste modelo, o líquido deve ser o contratado menos IOF, tarifas, seguro e outros custos descontados na liberação.');
 const r=c.rate/100, payment=r?c.principal*r/(-Math.expm1(-c.count*Math.log1p(r))):c.principal/c.count;
 let balance=c.principal; const rows=[];
 for(let i=0;i<c.count;i++) {
  const interest=Math.round(balance*r), amortization=i===c.count-1?balance:Math.min(balance,c.system==='SAC'?Math.round(c.principal/c.count):Math.round(payment-interest));
  if(amortization<0)throw Error('Taxa incompatível com o arredondamento.');
  balance-=amortization;
  rows.push({number:i+1,due:dateAt(c.first,i),interest,amortization,charges:c.monthlyCharge,total:amortization+interest+c.monthlyCharge,balance});
 }
 return rows;
}
export function installmentStatus(row,payments,today){return payments?.[row.number]?'Paga':row.due<today?'Atrasada':'Pendente'}
export function summary(c,today){const rows=schedule(c),paid=rows.filter(r=>c.payments?.[r.number]);return {rows,total:rows.reduce((s,r)=>s+r.total,0),interest:rows.reduce((s,r)=>s+r.interest,0),balance:c.principal-paid.reduce((s,r)=>s+r.amortization,0),outstanding:rows.filter(r=>!c.payments?.[r.number]).reduce((s,r)=>s+r.total,0),late:rows.filter(r=>installmentStatus(r,c.payments,today)==='Atrasada').length,annual:(Math.pow(1+c.rate/100,12)-1)*100};}
