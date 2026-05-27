const STORE_V='haircrm_visits', STORE_E='haircrm_expenses', STORE_P='haircrm_products';
const czk=n=>`${Math.round(Number(n||0)).toLocaleString('cs-CZ')} CZK`;
const monthOf=d=>(d||'').slice(0,7);
const today=()=>new Date().toISOString().slice(0,10);
let state={visits:[],expenses:[],products:[]}, draftItems=[], draftMaterials=[], history=[];

function load(){
  const oldV=localStorage.getItem(STORE_V), oldE=localStorage.getItem(STORE_E), oldP=localStorage.getItem(STORE_P);
  state.visits=oldV?JSON.parse(oldV):(window.INITIAL_DATA?.visits||[]);
  state.expenses=oldE?JSON.parse(oldE):(window.INITIAL_DATA?.expenses||[]);
  state.products=oldP?JSON.parse(oldP):(window.INITIAL_DATA?.products||[]);
  normalizeAll();
}
function save(){localStorage.setItem(STORE_V,JSON.stringify(state.visits));localStorage.setItem(STORE_E,JSON.stringify(state.expenses));localStorage.setItem(STORE_P,JSON.stringify(state.products));}
function snapshot(){history.push(JSON.stringify(state));if(history.length>50)history.shift();}
function undo(){if(!history.length)return toast('Немає дії для відміни');state=JSON.parse(history.pop());save();render();}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.style.display='block';setTimeout(()=>el.style.display='none',2500);}
function itemSales(items){return(items||[]).reduce((s,i)=>s+num(i.qty)*num(i.price),0)}
function itemCost(items){return(items||[]).reduce((s,i)=>s+num(i.qty)*num(i.cost),0)}
function matCost(mats){return(mats||[]).reduce((s,m)=>s+num(m.qty)*num(m.cost),0)}
function num(x){return Number(x||0)}
function normalizeVisit(v){
  v.date=v.date||today(); v.month=monthOf(v.date); v.name=v.name||'Без імені'; v.service=v.service||'Без опису';
  v.service_price=num(v.service_price); v.sales_manual=num(v.sales_manual ?? v.sales ?? 0); v.items=v.items||[]; v.materials=v.materials||[];
  v.sales=v.sales_manual+itemSales(v.items); v.visit_expenses=itemCost(v.items)+matCost(v.materials);
  v.total=v.service_price+v.sales; v.profit=v.total-v.visit_expenses; return v;
}
function normalizeAll(){state.visits=state.visits.map(normalizeVisit).sort((a,b)=>a.date.localeCompare(b.date));state.expenses=state.expenses.map(e=>({...e,date:e.date||today(),month:monthOf(e.date||today()),amount:num(e.amount)}));state.products=state.products.map(p=>({name:p.name||'Без назви',type:p.type||'Товар',price:num(p.price),cost:num(p.cost)}));}

function unique(arr){return [...new Set(arr.filter(Boolean))].sort()}
function setDatalist(id, arr){const el=document.getElementById(id); if(el) el.innerHTML=arr.map(x=>`<option value="${escapeHtml(x)}">`).join('');}
function renderSelects(){
 setDatalist('clientsList',unique(state.visits.map(v=>v.name)));
 setDatalist('servicesList',unique(state.visits.map(v=>v.service).concat(state.products.filter(p=>p.type==='Послуга').map(p=>p.name))));
 setDatalist('materialsList',unique(state.visits.flatMap(v=>v.materials.map(m=>m.name)).concat(state.products.filter(p=>p.type==='Матеріал').map(p=>p.name))));
 setDatalist('expenseCats',unique(state.expenses.map(e=>e.category).concat(['Оренда','SMM','Закупка Davines','Закупка Viart'])));
 const sel=document.getElementById('catalogSelect');
 sel.innerHTML='<option value="">Оберіть позицію</option>'+state.products.map((p,i)=>`<option value="${i}">${escapeHtml(p.name)} · ${escapeHtml(p.type)} · ${czk(p.price)}</option>`).join('');
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

function addProduct(){
 const name=document.getElementById('productName').value.trim(), type=document.getElementById('productType').value, price=num(document.getElementById('productPrice').value), cost=num(document.getElementById('productCost').value);
 if(!name||!price)return alert('Вкажіть назву і ціну');
 snapshot(); state.products.push({name,type,price,cost}); save(); ['productName','productPrice','productCost'].forEach(id=>document.getElementById(id).value=''); render(); toast('Позицію додано в базу');
}
function deleteProduct(i){if(!confirm('Видалити позицію з бази?'))return;snapshot();state.products.splice(i,1);save();render();}
function addDraftItem(){
 const idx=document.getElementById('catalogSelect').value; if(idx==='')return alert('Оберіть позицію з бази');
 const p=state.products[num(idx)], qty=num(document.getElementById('catalogQty').value)||1;
 draftItems.push({name:p.name,type:p.type,qty,price:p.price,cost:p.cost}); renderDrafts(); toast('Позицію додано до чеку');
}
function removeDraftItem(i){draftItems.splice(i,1);renderDrafts();}
function addMaterial(){
 const name=document.getElementById('matName').value.trim(), qty=num(document.getElementById('matQty').value)||1, cost=num(document.getElementById('matCost').value);
 if(!name||!cost)return alert('Вкажіть матеріал і собівартість');
 draftMaterials.push({name,qty,cost}); document.getElementById('matName').value='';document.getElementById('matCost').value='';renderDrafts();
}
function removeDraftMaterial(i){draftMaterials.splice(i,1);renderDrafts();}
function renderDrafts(){
 document.querySelector('#draftItemsTable tbody').innerHTML=draftItems.map((x,i)=>`<tr><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.type)}</td><td>${x.qty}</td><td>${czk(x.price)}</td><td>${czk(x.qty*x.price)}</td><td><button class="danger" onclick="removeDraftItem(${i})">×</button></td></tr>`).join('');
 document.querySelector('#draftMaterialsTable tbody').innerHTML=draftMaterials.map((x,i)=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.qty}</td><td>${czk(x.cost)}</td><td>${czk(x.qty*x.cost)}</td><td><button class="danger" onclick="removeDraftMaterial(${i})">×</button></td></tr>`).join('');
 document.getElementById('draftItemsTotal').textContent=czk(itemSales(draftItems));
 document.getElementById('draftMaterialsTotal').textContent=czk(matCost(draftMaterials));
}
function addVisit(){
 const date=document.getElementById('visitDate').value||today();
 snapshot();
 state.visits.push(normalizeVisit({date,name:document.getElementById('visitName').value||'Без імені',service:document.getElementById('visitService').value||'Без опису',service_price:num(document.getElementById('visitServicePrice').value),sales_manual:num(document.getElementById('visitManualSales').value),items:[...draftItems],materials:[...draftMaterials]}));
 draftItems=[]; draftMaterials=[]; save(); render(); toast('Запис додано');
}
function deleteVisit(i){if(!confirm('Видалити запис?'))return;snapshot();state.visits.splice(i,1);save();render();}
function addExpense(){
 const date=document.getElementById('expenseDate').value||today(), category=document.getElementById('expenseCategory').value||'Витрата', amount=num(document.getElementById('expenseAmount').value);
 if(!amount)return alert('Вкажіть суму витрати'); snapshot(); state.expenses.push({date,month:monthOf(date),category,amount}); save(); render(); toast('Витрату додано');
}
function deleteExpense(i){if(!confirm('Видалити витрату?'))return;snapshot();state.expenses.splice(i,1);save();render();}

function monthly(){
 const m={}; state.visits.forEach(v=>{m[v.month]??={service:0,sales:0,revenue:0,visitExp:0,businessExp:0,count:0};m[v.month].service+=v.service_price;m[v.month].sales+=v.sales;m[v.month].revenue+=v.total;m[v.month].visitExp+=v.visit_expenses;m[v.month].count++;});
 state.expenses.forEach(e=>{m[e.month]??={service:0,sales:0,revenue:0,visitExp:0,businessExp:0,count:0};m[e.month].businessExp+=e.amount;});
 Object.values(m).forEach(x=>x.profit=x.revenue-x.visitExp-x.businessExp); return m;
}
function clients(){
 const c={}; state.visits.forEach(v=>{if(v.name==='Окремі продажі')return;c[v.name]??={name:v.name,visits:0,revenue:0,profit:0,last:v.date};c[v.name].visits++;c[v.name].revenue+=v.total;c[v.name].profit+=v.profit;c[v.name].last=c[v.name].last>v.date?c[v.name].last:v.date;});
 return Object.values(c).sort((a,b)=>b.revenue-a.revenue);
}
function renderCards(){
 const t=Object.values(monthly()).reduce((a,x)=>({service:a.service+x.service,sales:a.sales+x.sales,revenue:a.revenue+x.revenue,exp:a.exp+x.visitExp+x.businessExp,profit:a.profit+x.profit,count:a.count+x.count}),{service:0,sales:0,revenue:0,exp:0,profit:0,count:0});
 set('kRevenue',czk(t.revenue));set('kProfit',czk(t.profit));set('kServices',czk(t.service));set('kSales',czk(t.sales));set('kExpenses',czk(t.exp));set('kClients',clients().length);set('kAvg',czk(t.count?t.revenue/t.count:0));set('kVisits',t.count);
}
function set(id,v){const e=document.getElementById(id); if(e) e.textContent=v;}
function renderTables(){
 const q=(document.getElementById('search').value||'').toLowerCase();
 document.querySelector('#productsTable tbody').innerHTML=state.products.map((p,i)=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.type)}</td><td class="money">${czk(p.price)}</td><td class="money">${czk(p.cost)}</td><td><button class="danger" onclick="deleteProduct(${i})">×</button></td></tr>`).join('');
 document.querySelector('#visitsTable tbody').innerHTML=state.visits.map((v,i)=>({v,i})).filter(({v})=>[v.date,v.name,v.service].join(' ').toLowerCase().includes(q)).map(({v,i})=>`<tr><td>${v.date}</td><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.service)}</td><td class="money">${czk(v.service_price)}</td><td class="money">${czk(v.sales)}</td><td class="money">${czk(v.total)}</td><td class="note">${v.items.map(x=>`${escapeHtml(x.name)} ${x.qty}×${czk(x.price)}`).join('<br>')}</td><td class="money">${czk(v.visit_expenses)}</td><td class="money ${v.profit<0?'negative':'positive'}">${czk(v.profit)}</td><td><button class="danger" onclick="deleteVisit(${i})">×</button></td></tr>`).join('');
 document.querySelector('#clientsTable tbody').innerHTML=clients().map(c=>`<tr><td>${escapeHtml(c.name)}</td><td>${c.visits}</td><td>${c.last}</td><td class="money">${czk(c.revenue)}</td><td class="money ${c.profit<0?'negative':'positive'}">${czk(c.profit)}</td></tr>`).join('');
 const now=today(); document.querySelector('#recallTable tbody').innerHTML=clients().map(c=>({...c,days:Math.max(0,Math.floor((new Date(now)-new Date(c.last))/(86400000)))})).filter(c=>c.days>=45).sort((a,b)=>b.days-a.days).map(c=>`<tr><td>${escapeHtml(c.name)}</td><td>${c.last}</td><td>${c.days}</td><td>${c.visits}</td></tr>`).join('');
 const m=monthly(); document.querySelector('#monthlyTable tbody').innerHTML=Object.keys(m).sort().map(k=>{const x=m[k];return`<tr><td>${k}</td><td class="money">${czk(x.service)}</td><td class="money">${czk(x.sales)}</td><td class="money">${czk(x.revenue)}</td><td class="money">${czk(x.visitExp+x.businessExp)}</td><td class="money ${x.profit<0?'negative':'positive'}">${czk(x.profit)}</td><td>${x.count}</td></tr>`}).join('');
 document.querySelector('#expensesTable tbody').innerHTML=state.expenses.map((e,i)=>`<tr><td>${e.date}</td><td>${escapeHtml(e.category)}</td><td class="money">${czk(e.amount)}</td><td><button class="danger" onclick="deleteExpense(${i})">×</button></td></tr>`).join('');
}
function draw(id, labels, vals, title){
 const c=document.getElementById(id); const ctx=c.getContext('2d'); const dpr=window.devicePixelRatio||1; c.width=c.clientWidth*dpr; c.height=220*dpr; ctx.scale(dpr,dpr); const W=c.clientWidth,H=220,p=36,max=Math.max(...vals,1); ctx.clearRect(0,0,W,H); ctx.fillStyle='#152033'; ctx.font='13px Arial'; ctx.fillText(title,12,20); vals.forEach((v,i)=>{const slot=(W-p*2)/vals.length,bw=slot*.55,x=p+i*slot+8,bh=(H-p*2)*(v/max),y=H-p-bh;ctx.fillStyle='#1f4e78';ctx.fillRect(x,y,bw,bh);ctx.fillStyle='#6b7280';ctx.fillText(labels[i].slice(5),x,H-10);});
}
function renderCharts(){const m=monthly(), labels=Object.keys(m).sort(); draw('revenueChart',labels,labels.map(k=>m[k].revenue),'Оборот по місяцях'); draw('profitChart',labels,labels.map(k=>Math.max(m[k].profit,0)),'Прибуток по місяцях');}
function render(){normalizeAll();renderSelects();renderDrafts();renderCards();renderTables();renderCharts();}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='hair-crm-backup.json';a.click();URL.revokeObjectURL(url);}
function importBackup(){const f=document.getElementById('importFile').files[0]; if(!f)return alert('Оберіть JSON backup'); const r=new FileReader(); r.onload=()=>{try{snapshot();state=JSON.parse(r.result);save();render();toast('Backup відновлено');}catch(e){alert('Не вдалося прочитати backup')}}; r.readAsText(f);}
document.addEventListener('DOMContentLoaded',()=>{load(); document.getElementById('visitDate').value=today(); document.getElementById('expenseDate').value=today();
 document.getElementById('addProduct').onclick=addProduct; document.getElementById('addCatalogItem').onclick=addDraftItem; document.getElementById('addMaterial').onclick=addMaterial; document.getElementById('addVisit').onclick=addVisit; document.getElementById('addExpense').onclick=addExpense; document.getElementById('undoBtn').onclick=undo; document.getElementById('exportBtn').onclick=exportBackup; document.getElementById('importBtn').onclick=importBackup; document.getElementById('search').oninput=renderTables;
 document.getElementById('visitService').onchange=()=>{const val=document.getElementById('visitService').value.toLowerCase(); const p=state.products.find(x=>x.type==='Послуга'&&x.name.toLowerCase()===val); if(p)document.getElementById('visitServicePrice').value=p.price;};
 render();});
