import {createResolver} from './resolver.js';
const $=id=>document.getElementById(id);let r,v,db,scale=1,active,fullImageURL,savedVehicles=[];const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('asa-pocket',1);req.onupgradeneeded=()=>req.result.createObjectStore('catalogue');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function readPack(key='active'){return new Promise((resolve,reject)=>{const req=db.transaction('catalogue').objectStore('catalogue').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function storePack(pack,key='active'){return new Promise((resolve,reject)=>{const tx=db.transaction('catalogue','readwrite');tx.objectStore('catalogue').put(pack,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage was interrupted'))})}
const imageURLs=new Map;
function newImageURL(id){const raw=atob(r.pack.images[id]);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return URL.createObjectURL(new Blob([bytes],{type:'image/png'}))}
function releaseImages(){for(const url of imageURLs.values())URL.revokeObjectURL(url);imageURLs.clear();if(fullImageURL){URL.revokeObjectURL(fullImageURL);fullImageURL=null}}
function imageURL(id){if(!imageURLs.has(id))imageURLs.set(id,newImageURL(id));return imageURLs.get(id)}
function loaded(pack){releaseImages();r=createResolver(pack);$('setup').hidden=true;$('workspace').hidden=false;$('dataStatus').textContent=`ASA ${pack.version} · ${pack.tables.vehicles.length.toLocaleString()} vehicles${pack.fixture?' · LOCAL TEST DATA':''}`;$('connection').textContent=navigator.onLine?'Ready · catalogue stored on this device':'Offline · catalogue available';renderSavedVehicles() }
async function importPack(blob){$('importStatus').textContent='Reading and checking your catalogue…';try{const stream=blob.stream().pipeThrough(new DecompressionStream('gzip'));const pack=JSON.parse(await new Response(stream).text());if(pack.format!=='asa-personal-pack'||pack.schema!==1||!pack.tables?.vehicles?.length||!pack.tables?.part_applications||!pack.images)throw Error('This is not a supported ASA data pack.');$('importStatus').textContent='Saving catalogue on this device…';await storePack(pack);if(navigator.storage?.persist)await navigator.storage.persist();loaded(pack)}catch(e){$('importStatus').textContent='Import failed: '+e.message+'. Your previously saved catalogue is unchanged.'}}
$('file').onchange=e=>{if(e.target.files[0])importPack(e.target.files[0])};$('settings').onclick=()=>{$('setup').hidden=false;$('workspace').hidden=true;$('drawing').hidden=true;$('importStatus').textContent=r?'Choose a new pack to replace this device’s catalogue.':''};
if(['localhost','127.0.0.1'].includes(location.hostname)){$('testpack').hidden=false;$('testpack').onclick=async()=>{try{await importPack(await(await fetch('local-test-pack.asapack.gz')).blob())}catch(e){$('importStatus').textContent=e.message}}}
$('searchForm').onsubmit=e=>{e.preventDefault();$('results').replaceChildren();const found=r.search($('query').value);if(!found.length)$('results').append(text('p','No matching chassis in this catalogue.'));for(const item of found){const b=text('button',`${item.model}-${item.serial_number} · ${item.classification}`);b.className='result';b.onclick=()=>select(item);$('results').append(b)}if(found.length===1)select(found[0])};
function select(item){releaseImages();v=item;$('results').replaceChildren();$('drawing').hidden=true;$('vehicle').replaceChildren();$('groups').replaceChildren();const card=document.createElement('article');card.className='card';card.append(text('h2',`${v.model}-${v.serial_number}`));const meta=document.createElement('div');meta.className='meta';for(const [k,value]of [['Model',v.type||v.model],['Classification',v.classification],['Production',v.production_period??'Unknown'],['OPC',v.opc],['Exterior code',v.exterior||'Not decoded'],['Interior code',v.interior||'Not decoded']]){const f=document.createElement('div');f.append(text('small',k),text('span',value));meta.append(f)}card.append(meta);const o=text('p',r.unknown(v)?'Factory options require verification. Option-dependent parts are candidates.':'Factory options: '+([...r.options(v)].join(' · ')||'No Option IDs in matched package'));o.className=r.unknown(v)?'warning':'options';card.append(o);const saveButton=text('button',savedVehicles.some(x=>x.chassis===chassisKey(v))?'Edit saved vehicle':'Save vehicle');saveButton.id='saveCurrentVehicle';saveButton.onclick=openSaveVehicle;card.append(saveButton);$('vehicle').append(card);const diagrams=r.diagrams(v);const groups=new Map;for(const d of diagrams){const key=`Group ${d.main_group} / Subgroup ${d.sub_group}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(d)}if(!diagrams.length)$('groups').append(text('p','No applicable diagrams in the imported data.'));for(const [name,ds]of groups){const h=text('h3',name);h.className='groupTitle';$('groups').append(h);for(const d of ds){const b=document.createElement('button');b.className='diagramButton';if(r.pack.images[d.illustration_id]){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.src=imageURL(d.illustration_id);b.append(img)}const label=text('span',d.illustration_id);label.append(text('small',r.pack.images[d.illustration_id]?`${r.hotspots(d.illustration_id).length} PNC hotspots`:'Original image unavailable'));b.append(label);b.onclick=()=>draw(d);$('groups').append(b)}}}
function draw(d){
 active=d;$('drawing').hidden=false;$('workspace').hidden=true;
 $('drawingTitle').textContent=d.illustration_id;$('canvas').replaceChildren();
 $('directImage').hidden=true;
 if(!r.pack.images[d.illustration_id]){
  $('imageStatus').textContent='Original image unavailable';
  $('canvas').append(text('p','This original illustration is missing from the supplied ASA data.'));return;
 }
 // Release the hidden gallery before decoding a fresh full-size image.
 $('groups').replaceChildren();releaseImages();
 const url=fullImageURL=newImageURL(d.illustration_id);
 $('directImage').href=url;$('directImage').hidden=false;
 const img=document.createElement('img');
 img.className='diagramImage';img.alt='Original Mitsubishi exploded diagram';
 img.decoding='async';img.draggable=false;
 img.onload=()=>{if(img.isConnected)$('imageStatus').textContent='Image ready · viewer 5';};
 img.onerror=()=>{$('imageStatus').textContent='Image could not be decoded. Use Open image directly.';};
 $('imageStatus').textContent='Loading image…';$('canvas').append(img);img.src=url;
 for(const h of r.hotspots(d.illustration_id)){
  const b=document.createElement('button');b.setAttribute('aria-label','PNC '+h.pnc);
  b.dataset.pnc=h.pnc;b.onclick=()=>lookup(h.pnc);
  b.dataset.x=h.x;b.dataset.y=h.y;b.dataset.w=h.width;b.dataset.h=h.height;
  $('canvas').append(b);
 }
 scale=Math.min(1,$('viewport').clientWidth/d.width);resize();
 $('viewport').scrollTop=0;$('viewport').scrollLeft=0;$('drawing').scrollIntoView({block:'start'});
}
function resize(){if(!active)return;$('canvas').style.width=active.width*scale+'px';$('canvas').style.height='auto';for(const b of $('canvas').querySelectorAll('button')){b.style.left=b.dataset.x*scale+'px';b.style.top=b.dataset.y*scale+'px';b.style.width=b.dataset.w*scale+'px';b.style.height=b.dataset.h*scale+'px'}$('zoomlevel').textContent=Math.round(scale*100)+'%'}
$('zoomin').onclick=()=>{scale=Math.min(4,scale*1.3);resize()};$('zoomout').onclick=()=>{scale=Math.max(.2,scale/1.3);resize()};$('back').onclick=()=>{select(v);$('drawing').hidden=true;$('workspace').hidden=false};let pinch=null;const distance=ts=>Math.hypot(ts[0].clientX-ts[1].clientX,ts[0].clientY-ts[1].clientY);$('viewport').addEventListener('touchstart',e=>{if(e.touches.length===2)pinch={distance:distance(e.touches),scale}},{passive:true});$('viewport').addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){e.preventDefault();scale=Math.max(.2,Math.min(4,pinch.scale*distance(e.touches)/pinch.distance));resize()}},{passive:false});$('viewport').addEventListener('touchend',()=>pinch=null);
function lookup(pnc){const result=r.lookup(v,pnc);$('partContent').replaceChildren(text('h2','PNC '+pnc),text('p',`${v.model}-${v.serial_number} · ${v.classification} · ${v.production_period??'Period unknown'}`));if(!result.parts.length)$('partContent').append(text('p',result.status==='notImported'?'Application data not imported. This does not establish that the part was not fitted.':'No applicable part for this chassis in the imported applications.'));for(const p of result.parts){const a=document.createElement('article');a.className='card';a.append(text('div',p.part_number),text('p',p.exact?'Matches decoded chassis conditions':'Candidate — requires verification'),text('p',p.qualifier?(r.pack.qualifierDescriptions[p.qualifier]||p.qualifier):'Generic application'),text('p',`Production ${p.start_period??'open'}–${p.end_period??'open'}`));a.firstChild.className='partno';$('partContent').append(a)}if(result.parts.length>1)$('partContent').append(text('p','Multiple part numbers remain. Replacement order has not been established.'));$('parts').showModal()}
$('closeParts').onclick=()=>$('parts').close();

const chassisKey=vehicle=>vehicle.model+'-'+vehicle.serial_number;
function renderSavedVehicles(){
 const list=$('savedVehicleList');list.replaceChildren();
 if(!savedVehicles.length){list.append(text('p','Search for a chassis, then tap Save vehicle to add your car here.'));return;}
 for(const entry of [...savedVehicles].sort((a,b)=>a.nickname.localeCompare(b.nickname))){
  const row=document.createElement('div');row.className='savedRow';
  const open=document.createElement('button');open.className='savedOpen';
  open.append(text('strong',entry.nickname||entry.chassis),text('small',entry.chassis));
  open.setAttribute('aria-label','Open '+(entry.nickname||entry.chassis));
  open.onclick=()=>{
   const matches=r.search(entry.chassis).filter(vehicle=>chassisKey(vehicle)===entry.chassis);
   if(matches.length!==1){$('savedVehicleStatus').textContent=entry.chassis+' cannot be identified uniquely in this imported catalogue.';return;}
   $('savedVehicleStatus').textContent='';$('query').value=entry.chassis;select(matches[0]);$('vehicle').scrollIntoView({block:'start'});
  };
  const remove=text('button','Remove');remove.className='savedRemove';
  remove.setAttribute('aria-label','Remove '+(entry.nickname||entry.chassis));
  remove.onclick=async()=>{
   const next=savedVehicles.filter(item=>item.chassis!==entry.chassis);remove.disabled=true;
   try{await storePack(next,'savedVehicles');savedVehicles=next;renderSavedVehicles();
    if(v&&chassisKey(v)===entry.chassis)$('saveCurrentVehicle').textContent='Save vehicle';
    $('savedVehicleStatus').textContent='Removed from My vehicles.';
   }catch(e){remove.disabled=false;$('savedVehicleStatus').textContent='Could not save the change. Your saved vehicles are unchanged.';}
  };
  row.append(open,remove);list.append(row);
 }
}
function openSaveVehicle(){
 const key=chassisKey(v),existing=savedVehicles.find(entry=>entry.chassis===key);
 $('saveVehicleHeading').textContent=existing?'Edit saved vehicle':'Save vehicle';
 $('saveVehicleChassis').textContent=key;
 $('vehicleNickname').value=existing?.nickname||key;
 $('saveVehicleError').textContent='';$('saveVehicleDialog').showModal();$('vehicleNickname').focus();
}
$('cancelSaveVehicle').onclick=()=>$('saveVehicleDialog').close();
$('saveVehicleForm').onsubmit=async event=>{
 event.preventDefault();const key=chassisKey(v),nickname=$('vehicleNickname').value.trim().slice(0,80)||key;
 const next=[...savedVehicles.filter(entry=>entry.chassis!==key),{chassis:key,nickname}];
 $('confirmSaveVehicle').disabled=true;
 try{await storePack(next,'savedVehicles');savedVehicles=next;renderSavedVehicles();
  $('saveCurrentVehicle').textContent='Edit saved vehicle';$('saveVehicleDialog').close();
  $('savedVehicleStatus').textContent='Saved '+nickname+'.';
 }catch(e){$('saveVehicleError').textContent='Could not save this vehicle. Your existing saved vehicles are unchanged.';}
 finally{$('confirmSaveVehicle').disabled=false;}
};

try{db=await openDB();const preferences=await readPack('savedVehicles');savedVehicles=Array.isArray(preferences)?preferences.filter(x=>x&&typeof x.chassis==='string'&&/^[A-Z0-9]+-[0-9]{7}$/.test(x.chassis)&&typeof x.nickname==='string').map(x=>({chassis:x.chassis,nickname:x.nickname.slice(0,80)})):[];const saved=await readPack();if(saved)loaded(saved)}catch(e){$('importStatus').textContent='Local storage unavailable: '+e.message}
if('serviceWorker' in navigator && window.isSecureContext){
 $('offlineStatus').textContent='Preparing app for offline use…';
 try{
  await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  $('offlineStatus').textContent='App saved for offline use. Import your catalogue here, then test in airplane mode.';
 }catch(e){$('offlineStatus').textContent='Offline setup failed. Reopen with internet access before testing offline.';}
}else{$('offlineStatus').textContent='Offline installation needs a secure web address.';}
