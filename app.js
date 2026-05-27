
const czk = n => `${Number(n||0).toLocaleString('cs-CZ')} CZK`;
const monthFromDate = d => (d||'').slice(0,7);
const daysBetween = (a,b) => Math.floor((new Date(b)-new Date(a))/(1000*60*60*24));

let visits = JSON.parse(localStorage.getItem('haircrm_visits') || 'null') || initialVisits;
let expenses = JSON.parse(localStorage.getItem('haircrm_expenses') || 'null') || initialExpenses;
let products = JSON.parse(localStorage.getItem('haircrm_products') || 'null') || initialProducts;
let draftItems = [];
let draftMaterials = [];
let historyStack = [];

function snapshot(){historyStack.push({visits:JSON.stringify(visits), expenses:JSON.stringify(expenses), products:JSON.stringify(products)}); if(historyStack.length>50) historyStack.shift();}
function save(){localStorage.setItem('haircrm_visits',JSON.stringify(visits)); localStorage.setItem('haircrm_expenses',JSON.stringify(expenses)); localStorage.setItem('haircrm_products',JSON.stringify(products));}
function itemSalesTotal(items){return (items||[]).reduce((s,i)=>s+Number(i.qty||0)*Number(i.price||0),0)}
function itemCostTotal(items){return (items||[]).reduce((s,i)=>s+Number(i.qty||0)*Number(i.cost||0),0)}
function materialTotal(materials){return (materials||[]).reduce((s,m)=>s+Number(m.qty||0)*Number(m.cost||0),0)}
function calcVisit(v){
  v.month = v.month || monthFromDate(v.date);
  v.service_price = Number(v.service_price||0);
  v.sales_manual = Number(v.sales_manual ?? v.sales ?? 0);
  v.items = v.items || [];
  v.materials = v.materials || [];
  v.sales = v.sales_manual + itemSalesTotal(v.items);
  v.visit_expenses = materialTotal(v.materials) + itemCostTotal(v.items);
  v.total = v.service_price + v.sales;
  v.profit = v.total - v.visit_expenses;
  return v;
}
function prepare(){visits = visits.map(calcVisit).sort((a,b)=>a.date.localeCompare(b.date));}

function getMonthly(){
  prepare();
  const months = {};
  for(const v of visits){
    const m=v.month; months[m] ||= {service:0,sales:0,revenue:0,visitExp:0,businessExp:0,profit:0,count:0};
    months[m].service += v.service_price; months[m].sales += v.sales; months[m].revenue += v.total; months[m].visitExp += v.visit_expenses; months[m].count++;
  }
  for(const e of expenses){
    const m=e.month || monthFromDate(e.date); months[m] ||= {service:0,sales:0,revenue:0,visitExp:0,businessExp:0,profit:0,count:0};
    months[m].businessExp += Number(e.amount||0);
  }
  Object.keys(months).forEach(m=> months[m].profit = months[m].revenue - months[m].visitExp - months[m].businessExp);
  return months;
}
function getClients(){
  prepare();
  const clients = {};
  for(const v of visits){
    if(v.name === 'Окремі продажі') continue;
    clients[v.name] ||= {name:v.name, visits:0, revenue:0, profit:0, sales:0, last:v.date, first:v.date, services:[]};
    const c=clients[v.name]; c.visits++; c.revenue+=v.total; c.profit+=v.profit; c.sales+=v.sales; c.last = c.last > v.date ? c.last : v.date; c.first = c.first < v.date ? c.first : v.date; c.services.push(v.service);
  }
  return Object.values(clients).sort((a,b)=>b.revenue-a.revenue);
}
function getServiceStats(){
  prepare();
  const s={};
  for(const v of visits){
    if(!v.service) continue;
    s[v.service] ||= {name:v.service,count:0,revenue:0,profit:0};
    s[v.service].count++; s[v.service].revenue += v.service_price; s[v.service].profit += v.profit;
  }
  return Object.values(s).sort((a,b)=>b.revenue-a.revenue);
}
function getProductStats(){
  prepare();
  const p={};
  for(const v of visits){
    for(const item of (v.items||[])){
      p[item.name] ||= {name:item.name,qty:0,revenue:0,profit:0};
      p[item.name].qty += Number(item.qty||0);
      p[item.name].revenue += Number(item.qty||0)*Number(item.price||0);
      p[item.name].profit += Number(item.qty||0)*(Number(item.price||0)-Number(item.cost||0));
    }
  }
  return Object.values(p).sort((a,b)=>b.revenue-a.revenue);
}
function getRecallList(){
  const today = new Date().toISOString().slice(0,10);
  return getClients().map(c=>({...c, days:daysBetween(c.last,today)})).filter(c=>c.days>=45).sort((a,b)=>b.days-a.days);
}

function updateDatalists(){
  const names=[...new Set(visits.map(v=>v.name).filter(Boolean))].sort();
  const services=[...new Set(visits.map(v=>v.service).filter(Boolean).concat(products.filter(p=>p.type==='Послуга').map(p=>p.name)))].sort();
  const cats=[...new Set(expenses.map(e=>e.category).filter(Boolean).concat(['Оренда','SMM','Закупка Davines','Закупка Viart']))].sort();
  const materials=[...new Set(visits.flatMap(v=>(v.materials||[]).map(m=>m.name)).filter(Boolean).concat(products.filter(p=>p.type==='Матеріал').map(p=>p.name)))].sort();
  setOptions('clientsList', names); setOptions('servicesList', services); setOptions('expenseCategoriesList', cats); setOptions('materialsList', materials);
  const cs=document.getElementById('catalogSelect'); if(cs) cs.innerHTML='<option value="">Оберіть позицію</option>'+products.map((p,i)=>`<option value="${i}">${p.name} · ${p.type} · ${czk(p.price)}</option>`).join('');
}
function setOptions(id, arr){const el=document.getElementById(id); if(el) el.innerHTML=arr.map(x=>`<option value="${x}">`).join('');}

function renderDrafts(){
  const itemsT=document.querySelector('#itemsTable tbody');
  if(itemsT) itemsT.innerHTML=draftItems.map((i,idx)=>`<tr><td>${i.name}</td><td>${i.type}</td><td>${i.qty}</td><td>${czk(i.price)}</td><td>${czk(i.qty*i.price)}</td><td><button class="danger" onclick="removeDraftItem(${idx})">×</button></td></tr>`).join('');
  const matsT=document.querySelector('#materialsTable tbody');
  if(matsT) matsT.innerHTML=draftMaterials.map((m,idx)=>`<tr><td>${m.name}</td><td>${m.qty}</td><td>${czk(m.cost)}</td><td>${czk(m.qty*m.cost)}</td><td><button class="danger" onclick="removeDraftMaterial(${idx})">×</button></td></tr>`).join('');
  const it=document.getElementById('itemsTotal'); if(it) it.textContent=czk(itemSalesTotal(draftItems));
  const mt=document.getElementById('materialsTotal'); if(mt) mt.textContent=czk(materialTotal(draftMaterials));
  const ex=document.getElementById('expense'); if(ex) ex.value = itemCostTotal(draftItems) + materialTotal(draftMaterials);
}
function addDraftItem(){
  const idx=document.getElementById('catalogSelect').value; if(idx===''){alert('Оберіть позицію з бази.'); return;}
  const p=products[Number(idx)], qty=Number(document.getElementById('catalogQty').value||1);
  draftItems.push({name:p.name,type:p.type,qty,price:Number(p.price||0),cost:Number(p.cost||0)});
  renderDrafts();
}
function removeDraftItem(i){draftItems.splice(i,1);renderDrafts();}
function addDraftMaterial(){
  const name=document.getElementById('materialName').value.trim(), qty=Number(document.getElementById('materialQty').value||1), cost=Number(document.getElementById('materialCost').value||0);
  if(!name || !cost){alert('Вкажіть матеріал і собівартість.');return;}
  draftMaterials.push({name,qty,cost}); document.getElementById('materialName').value=''; document.getElementById('materialCost').value=''; renderDrafts();
}
function removeDraftMaterial(i){draftMaterials.splice(i,1);renderDrafts();}

function addProduct(){
  const name=document.getElementById('productName').value.trim(), type=document.getElementById('productType').value, price=Number(document.getElementById('productPrice').value||0), cost=Number(document.getElementById('productCost').value||0);
  if(!name || !price){alert('Вкажіть назву і ціну.');return;}
  snapshot(); products.push({name,type,price,cost}); save(); renderAll();
}
function deleteProduct(i){ if(!confirm('Видалити позицію з бази?'))return; snapshot(); products.splice(i,1); save(); renderAll();}
function renderProducts(){
  const tb=document.querySelector('#productsTable tbody'); if(!tb)return;
  tb.innerHTML = products.map((p,i)=>`<tr><td>${p.name}</td><td>${p.type}</td><td class="money">${czk(p.price)}</td><td class="money">${czk(p.cost)}</td><td><button class="danger" onclick="deleteProduct(${i})">Видалити</button></td></tr>`).join('');
}

function addVisit(){
  const date=document.getElementById('date').value; if(!date){alert('Вкажіть дату.');return;}
  snapshot();
  visits.push(calcVisit({
    date, month:monthFromDate(date), name:document.getElementById('name').value||'Без імені',
    service:document.getElementById('service').value||'Без опису',
    service_price:Number(document.getElementById('servicePrice').value||0),
    sales_manual:Number(document.getElementById('sales').value||0),
    items:[...draftItems], materials:[...draftMaterials]
  }));
  draftItems=[]; draftMaterials=[]; save(); renderAll();
}
function addExpense(){
  const date=document.getElementById('expenseDate').value; if(!date){alert('Вкажіть дату витрати.');return;}
  snapshot(); expenses.push({date,month:monthFromDate(date),category:document.getElementById('expenseCategory').value||'Витрата',amount:Number(document.getElementById('expenseAmount').value||0)}); save(); renderAll();
}
function deleteVisit(i){if(!confirm('Видалити запис?'))return; snapshot(); visits.splice(i,1); save(); renderAll();}
function deleteExpense(i){if(!confirm('Видалити витрату?'))return; snapshot(); expenses.splice(i,1); save(); renderAll();}
function undo(){const last=historyStack.pop(); if(!last){alert('Немає дії для відміни.');return;} visits=JSON.parse(last.visits); expenses=JSON.parse(last.expenses); products=JSON.parse(last.products); save(); renderAll();}

function renderTables(){
  prepare();
  const q=(document.getElementById('search')?.value||'').toLowerCase();
  const vt=document.querySelector('#visitsTable tbody');
  if(vt) vt.innerHTML=visits.map((v,i)=>({v,i})).filter(({v})=>[v.name,v.service,v.date].join(' ').toLowerCase().includes(q)).map(({v,i})=>{
    const items=(v.items||[]).map(x=>`${x.name}: ${x.qty}×${czk(x.price)}`).join('<br>');
    const mats=(v.materials||[]).map(x=>`${x.name}: ${x.qty}×${czk(x.cost)}`).join('<br>');
    return `<tr><td>${v.date}</td><td>${v.name}</td><td>${v.service}</td><td class="money">${czk(v.service_price)}</td><td class="money">${czk(v.sales)}</td><td class="money">${czk(v.total)}</td><td class="note">${items}</td><td class="money">${czk(v.visit_expenses)}<div class="note">${mats}</div></td><td class="money ${v.profit<0?'negative':'positive'}">${czk(v.profit)}</td><td><button class="danger" onclick="deleteVisit(${i})">Видалити</button></td></tr>`
  }).join('');

  const et=document.querySelector('#expensesTable tbody');
  if(et) et.innerHTML=expenses.map((e,i)=>({e,i})).sort((a,b)=>a.e.date.localeCompare(b.e.date)).map(({e,i})=>`<tr><td>${e.date}</td><td>${e.month}</td><td>${e.category}</td><td class="money negative">${czk(e.amount)}</td><td><button class="danger" onclick="deleteExpense(${i})">Видалити</button></td></tr>`).join('');

  const mt=document.querySelector('#monthlyTable tbody');
  if(mt){ const months=getMonthly(); mt.innerHTML=Object.keys(months).sort().map(m=>{const x=months[m];return `<tr><td>${m}</td><td>${czk(x.service)}</td><td>${czk(x.sales)}</td><td>${czk(x.revenue)}</td><td>${czk(x.visitExp)}</td><td>${czk(x.businessExp)}</td><td class="${x.profit<0?'negative':'positive'}">${czk(x.profit)}</td><td>${x.count}</td></tr>`}).join('');}

  const ct=document.querySelector('#clientsTable tbody');
  if(ct) ct.innerHTML=getClients().map(c=>`<tr><td>${c.name}</td><td>${c.visits}</td><td>${c.last}</td><td>${czk(c.revenue)}</td><td class="${c.profit<0?'negative':'positive'}">${czk(c.profit)}</td><td>${c.services.slice(-2).join('<br>')}</td></tr>`).join('');

  const rt=document.querySelector('#recallTable tbody');
  if(rt) rt.innerHTML=getRecallList().map(c=>`<tr><td>${c.name}</td><td>${c.last}</td><td>${c.days}</td><td>${c.visits}</td><td>${czk(c.revenue)}</td></tr>`).join('');

  const st=document.querySelector('#servicesTable tbody');
  if(st) st.innerHTML=getServiceStats().slice(0,12).map(s=>`<tr><td>${s.name}</td><td>${s.count}</td><td>${czk(s.revenue)}</td><td class="${s.profit<0?'negative':'positive'}">${czk(s.profit)}</td></tr>`).join('');

  const pt=document.querySelector('#productStatsTable tbody');
  if(pt) pt.innerHTML=getProductStats().slice(0,12).map(p=>`<tr><td>${p.name}</td><td>${p.qty}</td><td>${czk(p.revenue)}</td><td>${czk(p.profit)}</td></tr>`).join('');
}

function renderCards(){
  const months=getMonthly();
  const totals=Object.values(months).reduce((a,x)=>({service:a.service+x.service,sales:a.sales+x.sales,revenue:a.revenue+x.revenue,visitExp:a.visitExp+x.visitExp,businessExp:a.businessExp+x.businessExp,profit:a.profit+x.profit,count:a.count+x.count}),{service:0,sales:0,revenue:0,visitExp:0,businessExp:0,profit:0,count:0});
  setText('revenue',czk(totals.revenue)); setText('serviceRevenue',czk(totals.service)); setText('salesRevenue',czk(totals.sales)); setText('visitExpenses',czk(totals.visitExp)); setText('expensesTotal',czk(totals.businessExp)); setText('profit',czk(totals.profit)); setText('clientCount',getClients().length); setText('avgCheck',czk(totals.count ? totals.revenue/totals.count : 0));
}
function setText(id, val){const el=document.getElementById(id); if(el) el.textContent=val;}

function drawBar(canvasId, labels, values, title){
  const c=document.getElementById(canvasId); if(!c)return; const ctx=c.getContext('2d'), w=c.width=c.clientWidth*2, h=c.height=c.clientHeight*2; ctx.clearRect(0,0,w,h); ctx.scale(2,2);
  const W=c.clientWidth,H=c.clientHeight,p=34,max=Math.max(...values,1); ctx.font='12px Arial'; ctx.fillStyle='#172033'; ctx.fillText(title,12,18);
  values.forEach((v,i)=>{const bw=(W-p*2)/values.length*0.62, x=p+i*((W-p*2)/values.length)+8, bh=(H-p*2)*(v/max), y=H-p-bh; ctx.fillStyle='#1f4e78'; ctx.fillRect(x,y,bw,bh); ctx.fillStyle='#6b7280'; ctx.fillText(labels[i].slice(5),x,H-10);});
}
function drawPie(canvasId, data, title){
  const c=document.getElementById(canvasId); if(!c)return; const ctx=c.getContext('2d'), w=c.width=c.clientWidth*2,h=c.height=c.clientHeight*2; ctx.clearRect(0,0,w,h); ctx.scale(2,2);
  const W=c.clientWidth,H=c.clientHeight,total=data.reduce((s,d)=>s+d.value,0)||1; let start=0; const colors=['#1f4e78','#70ad47','#b94b4b','#f1c232','#674ea7','#76a5af'];
  ctx.font='12px Arial'; ctx.fillStyle='#172033'; ctx.fillText(title,12,18);
  data.forEach((d,i)=>{const a=d.value/total*Math.PI*2; ctx.beginPath(); ctx.moveTo(W/2,H/2+12); ctx.arc(W/2,H/2+12,Math.min(W,H)/3,start,start+a); ctx.closePath(); ctx.fillStyle=colors[i%colors.length]; ctx.fill(); start+=a;});
}
function renderCharts(){
  const months=getMonthly(); const labels=Object.keys(months).sort(), revenue=labels.map(m=>months[m].revenue), profit=labels.map(m=>months[m].profit);
  drawBar('revenueChart',labels,revenue,'Оборот по місяцях');
  drawBar('profitChart',labels,profit.map(x=>Math.max(x,0)),'Прибуток по місяцях');
  const expByCat={}; expenses.forEach(e=>expByCat[e.category]=(expByCat[e.category]||0)+Number(e.amount||0));
  drawPie('expensePie',Object.entries(expByCat).map(([label,value])=>({label,value})).slice(0,6),'Структура витрат');
  drawBar('clientsChart',labels,labels.map(m=>months[m].count),'Кількість записів');
}
function renderAll(){prepare(); updateDatalists(); renderProducts(); renderDrafts(); renderTables(); renderCards(); renderCharts();}

function exportData(){
  const blob=new Blob([JSON.stringify({visits,expenses,products},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='hair-crm-export.json'; a.click(); URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('addProduct')?.addEventListener('click',addProduct);
  document.getElementById('addCatalogItem')?.addEventListener('click',addDraftItem);
  document.getElementById('addMaterial')?.addEventListener('click',addDraftMaterial);
  document.getElementById('addVisit')?.addEventListener('click',addVisit);
  document.getElementById('addExpense')?.addEventListener('click',addExpense);
  document.getElementById('undoBtn')?.addEventListener('click',undo);
  document.getElementById('exportBtn')?.addEventListener('click',exportData);
  document.getElementById('search')?.addEventListener('input',renderTables);
  document.getElementById('service')?.addEventListener('change',()=>{const v=document.getElementById('service').value.toLowerCase(); const p=products.find(x=>x.type==='Послуга'&&x.name.toLowerCase()===v); if(p&&!document.getElementById('servicePrice').value)document.getElementById('servicePrice').value=p.price;});
  renderAll();
});
