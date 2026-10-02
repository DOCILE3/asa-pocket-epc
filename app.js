import {createResolver} from './resolver.js?v=18';
const $=id=>document.getElementById(id);let r,v,db,scale=1,active,fullImageURL,diagramHistory=[],activeSeries=[],pageIndex=0,savedVehicles=[],groupNames={};const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('asa-pocket',1);req.onupgradeneeded=()=>req.result.createObjectStore('catalogue');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function readPack(key='active'){return new Promise((resolve,reject)=>{const req=db.transaction('catalogue').objectStore('catalogue').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function storePack(pack,key='active'){return new Promise((resolve,reject)=>{const tx=db.transaction('catalogue','readwrite');tx.objectStore('catalogue').put(pack,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage was interrupted'))})}
const imageURLs=new Map;
function newImageURL(id){const raw=atob(r.pack.images[id]);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return URL.createObjectURL(new Blob([bytes],{type:'image/png'}))}
function releaseImages(){for(const url of imageURLs.values())URL.revokeObjectURL(url);imageURLs.clear();if(fullImageURL){URL.revokeObjectURL(fullImageURL);fullImageURL=null}}
function imageURL(id){if(!imageURLs.has(id))imageURLs.set(id,newImageURL(id));return imageURLs.get(id)}
function loaded(pack){partIndex=null;partRows=[];$('partSearchResults').replaceChildren();$('partSearchStatus').textContent='';$('morePartResults').hidden=true;releaseImages();r=createResolver(pack);$('setup').hidden=true;$('workspace').hidden=false;$('dataStatus').textContent=`ASA ${pack.version} · ${pack.tables.vehicles.length.toLocaleString()} vehicles${pack.fixture?' · LOCAL TEST DATA':''}`;$('connection').textContent=navigator.onLine?'Ready · catalogue stored on this device':'Offline · catalogue available';renderSavedVehicles() }
async function importPack(blob){$('importStatus').textContent='Reading and checking your catalogue…';try{const stream=blob.stream().pipeThrough(new DecompressionStream('gzip'));const pack=JSON.parse(await new Response(stream).text());if(pack.format==='asa-group-names'){if(pack.schema!==1||!pack.names||typeof pack.names!=='object'||Array.isArray(pack.names)||!Object.entries(pack.names).every(([key,value])=>/^[A-Z0-9]+\|[0-9]{2}(\|[0-9]{3})?$/.test(key)&&typeof value==='string'&&value.length<=200))throw Error('Unsupported group names file');await storePack(pack.names,'groupNames');groupNames=pack.names;$('importStatus').textContent='Group names saved on this device.';if(r){const current=v;loaded(r.pack);if(current)select(current);}return;}if(pack.format!=='asa-personal-pack'||pack.schema!==1||!pack.tables?.vehicles?.length||!pack.tables?.part_applications||!pack.images)throw Error('This is not a supported ASA data pack.');$('importStatus').textContent='Saving catalogue on this device…';await storePack(pack);if(navigator.storage?.persist)await navigator.storage.persist();loaded(pack)}catch(e){$('importStatus').textContent='Import failed: '+e.message+'. Your previously saved catalogue is unchanged.'}}
$('namesfile').onchange=e=>{if(e.target.files[0])importPack(e.target.files[0])};$('file').onchange=e=>{if(e.target.files[0])importPack(e.target.files[0])};$('settings').onclick=()=>{$('setup').hidden=false;$('workspace').hidden=true;$('drawing').hidden=true;$('importStatus').textContent=r?'Choose a new pack to replace this device’s catalogue.':''};
if(['localhost','127.0.0.1'].includes(location.hostname)){$('testpack').hidden=false;$('testpack').onclick=async()=>{try{await importPack(await(await fetch('local-test-pack.asapack.gz')).blob())}catch(e){$('importStatus').textContent=e.message}}}
$('searchForm').onsubmit=e=>{e.preventDefault();$('results').replaceChildren();const found=r.search($('query').value);if(!found.length)$('results').append(text('p','No matching chassis in this catalogue.'));for(const item of found){const b=text('button',`${item.model}-${item.serial_number} · ${item.classification}`);b.className='result';b.onclick=()=>select(item);$('results').append(b)}if(found.length===1)select(found[0])};
function select(item,preserveNavigation=false){diagramHistory=[];activeSeries=[];pageIndex=0;if(!preserveNavigation){browseCategory=null;browseSubgroup=null;}$('partSearchResults').replaceChildren();$('partSearchStatus').textContent='';$('morePartResults').hidden=true;releaseImages();v=item;$('results').replaceChildren();$('drawing').hidden=true;$('vehicle').replaceChildren();$('groups').replaceChildren();const card=document.createElement('article');card.className='card';card.append(text('h2',`${v.model}-${v.serial_number}`));const meta=document.createElement('div');meta.className='meta';for(const [k,value]of [['Model',v.type||v.model],['Classification',v.classification],['Production',v.production_period??'Unknown'],['OPC',v.opc],['Exterior code',v.exterior||'Not decoded'],['Interior code',v.interior||'Not decoded']]){const f=document.createElement('div');f.append(text('small',k),text('span',value));meta.append(f)}const details=document.createElement('details');details.append(text('summary','Vehicle details'),meta);card.append(details);const o=text('p',r.unknown(v)?'Factory options require verification. Option-dependent parts are candidates.':'Factory options: '+([...r.options(v)].join(' · ')||'No Option IDs in matched package'));o.className=r.unknown(v)?'warning':'options';details.append(o);const saveButton=text('button',savedVehicles.some(x=>x.chassis===chassisKey(v))?'Edit saved vehicle':'Save vehicle');saveButton.id='saveCurrentVehicle';saveButton.onclick=openSaveVehicle;card.append(saveButton);$('vehicle').append(card);const seenIllustrations=new Set;catalogueDiagrams=r.diagrams(v).filter(d=>{if(seenIllustrations.has(d.illustration_id))return false;seenIllustrations.add(d.illustration_id);return true;}).map(d=>{const code=d.illustration_id.match(/^\d(\d{2})_(\d{3})/);return code?{...d,main_group:code[1],sub_group:code[2]}:d;});renderCatalogueBrowser();}

function draw(d,series=null,index=0,position=null){
 const restorePosition=()=>{if(!position)return;$('viewport').scrollTop=position.top;$('viewport').scrollLeft=position.left;window.scrollTo(position.x,position.y);};
 if(series){activeSeries=series;pageIndex=index;}
 $('pageNavigation').hidden=activeSeries.length<2;$('pageCount').textContent='Diagram '+(pageIndex+1)+' of '+activeSeries.length;
 $('referenceNotice').hidden=!d.referenceOnly;
 $('referenceNotice').textContent=d.referenceOnly?'Reference drawing outside the current browse selection. Part results remain filtered to your chassis.':'';
 active=d;$('previousImage').hidden=!diagramHistory.length;$('drawing').hidden=false;$('workspace').hidden=true;
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
 img.decoding='async';img.draggable=false;img.width=d.width;img.height=d.height;
 img.onload=()=>{if(img.isConnected){$('imageStatus').textContent='Image ready · viewer 5';restorePosition();}};
 img.onerror=()=>{$('imageStatus').textContent='Image could not be decoded. Use Open image directly.';};
 $('imageStatus').textContent='Loading image…';$('canvas').append(img);img.src=url;
 for(const h of r.hotspots(d.illustration_id)){
  const b=document.createElement('button');const reference=diagramReference(h);
  b.setAttribute('aria-label',reference?'Open reference '+reference.main+'-'+reference.sub:'PNC '+h.pnc);
  b.dataset.pnc=h.pnc;b.onclick=()=>reference?openReference(reference):lookup(h.pnc);
  b.dataset.x=h.x;b.dataset.y=h.y;b.dataset.w=h.width;b.dataset.h=h.height;
  $('canvas').append(b);
 }
 scale=Math.min(1,$('viewport').clientWidth/d.width);resize();
 if(position)restorePosition();else{$('viewport').scrollTop=0;$('viewport').scrollLeft=0;$('drawing').scrollIntoView({block:'start'});}
}
function diagramReference(h){
 if(Number(h.flags)!==2)return null;
 const code=String(h.pnc).trim().match(/^(\d{2})[ -]+(\d{3})\)?$/);
 return code?{main:code[1],sub:code[2]}:null;
}
function referenceTargets(reference){return r.referenceDiagrams(v,reference.main,reference.sub);}
function openReference(reference){
 const targets=referenceTargets(reference);
 if(!targets.length){$('partContent').replaceChildren(text('h2','Reference '+reference.main+'-'+reference.sub),text('p','No matching reference drawing is available in the imported catalogue.'));$('parts').showModal();return;}
 diagramHistory.push({diagram:active,series:activeSeries,index:pageIndex,scale,top:$('viewport').scrollTop,left:$('viewport').scrollLeft,category:browseCategory,subgroup:browseSubgroup});
 const series=targets.map(d=>({...d,referenceOnly:!catalogueDiagrams.some(item=>item.illustration_id===d.illustration_id)}));
 browseCategory=categoryOf(series[0]);browseSubgroup=series[0].main_group+'|'+series[0].sub_group;
 $('parts').close();draw(series[0],series,0);
}
function previousImage(){
 const previous=diagramHistory.pop();if(!previous)return;
 browseCategory=previous.category;browseSubgroup=previous.subgroup;
 draw(previous.diagram,previous.series||[previous.diagram],previous.index||0);scale=previous.scale;resize();
 $('viewport').scrollTop=previous.top;$('viewport').scrollLeft=previous.left;
}
function cycleDiagram(step){
 if(activeSeries.length<2)return;
 const index=(pageIndex+step+activeSeries.length)%activeSeries.length;
 const position={x:window.scrollX,y:window.scrollY,top:$('viewport').scrollTop,left:$('viewport').scrollLeft};
 draw(activeSeries[index],activeSeries,index,position);
}
$('previousImage').onclick=previousImage;
$('previousPage').onclick=()=>cycleDiagram(-1);$('nextPage').onclick=()=>cycleDiagram(1);
function swipeDirection(start,end){
 const dx=end.x-start.x;return Math.abs(dx)>=80&&Math.abs(end.y-start.y)<40&&end.time-start.time<800?(dx<0?1:-1):0;
}
let pageSwipe=null;
$('viewport').addEventListener('touchstart',e=>{
 pageSwipe=null;if(e.touches.length!==1||!active)return;
 const viewport=$('viewport'),touch=e.touches[0],edge=touch.clientX-viewport.getBoundingClientRect().left;
 // Fit-size swipes turn pages; zoomed diagrams retain normal panning.
 if((activeSeries.length>1||(diagramHistory.length&&edge>=0&&edge<=40))&&viewport.scrollLeft===0&&active.width*scale<=viewport.clientWidth+2)
  pageSwipe={x:touch.clientX,y:touch.clientY,time:e.timeStamp};
},{passive:true});
$('viewport').addEventListener('touchmove',e=>{if(e.touches.length!==1)pageSwipe=null;},{passive:true});
$('viewport').addEventListener('touchend',e=>{
 const start=pageSwipe;pageSwipe=null;if(!start||e.touches.length||e.changedTouches.length!==1)return;
 const touch=e.changedTouches[0],direction=swipeDirection(start,{x:touch.clientX,y:touch.clientY,time:e.timeStamp});
 if(activeSeries.length>1&&direction)cycleDiagram(direction);else if(direction===-1)previousImage();
},{passive:true});
$('viewport').addEventListener('touchcancel',()=>{pageSwipe=null;},{passive:true});
function resize(){if(!active)return;$('canvas').style.width=active.width*scale+'px';$('canvas').style.height='auto';for(const b of $('canvas').querySelectorAll('button')){b.style.left=b.dataset.x*scale+'px';b.style.top=b.dataset.y*scale+'px';b.style.width=b.dataset.w*scale+'px';b.style.height=b.dataset.h*scale+'px'}$('zoomlevel').textContent=Math.round(scale*100)+'%'}
$('zoomin').onclick=()=>{scale=Math.min(4,scale*1.3);resize()};$('zoomout').onclick=()=>{scale=Math.max(.2,scale/1.3);resize()};$('back').onclick=()=>{browseSubgroup=null;select(v,true);$('drawing').hidden=true;$('workspace').hidden=false};let pinch=null;const distance=ts=>Math.hypot(ts[0].clientX-ts[1].clientX,ts[0].clientY-ts[1].clientY);$('viewport').addEventListener('touchstart',e=>{if(e.touches.length===2)pinch={distance:distance(e.touches),scale}},{passive:true});$('viewport').addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){e.preventDefault();scale=Math.max(.2,Math.min(4,pinch.scale*distance(e.touches)/pinch.distance));resize()}},{passive:false});$('viewport').addEventListener('touchend',()=>pinch=null);
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


let partIndex=null,partRows=[],partOffset=0;
const normalPartNumber=value=>(value||'').toUpperCase().replace(/[\s-]+/g,'');
$('partSearchForm').onsubmit=event=>{
 event.preventDefault();$('partSearchResults').replaceChildren();$('morePartResults').hidden=true;
 const number=normalPartNumber($('partQuery').value);
 if(!/^[A-Z0-9]{3,20}$/.test(number)){$('partSearchStatus').textContent='Enter a Mitsubishi part number, for example MR166160.';return;}
 if(!partIndex){partIndex=new Map;for(const row of r.pack.tables.part_applications){const key=normalPartNumber(row.part_number);if(!partIndex.has(key))partIndex.set(key,[]);partIndex.get(key).push(row);}}
 const seen=new Set;partRows=(partIndex.get(number)||[]).filter(row=>{const key=JSON.stringify([row.model,row.pnc,row.classifications,row.start_period,row.end_period,row.qualifier,row.combination_codes]);if(seen.has(key))return false;seen.add(key);return true;});partOffset=0;
 if(!partRows.length){$('partSearchStatus').textContent='No exact match in this imported catalogue. Other Mitsubishi models or replacement numbers may not be included.';return;}
 $('partSearchStatus').textContent=number+' · '+partRows.length+' catalogue application'+(partRows.length===1?'':'s')+'. Description is not included in this data pack.';
 if(v){const matched=partRows.filter(row=>row.model===v.model).flatMap(row=>r.lookup(v,row.pnc).parts).filter(part=>normalPartNumber(part.part_number)===number);$('partSearchResults').append(text('p',chassisKey(v)+': '+(matched.length?(matched.some(part=>part.exact)?'Matches decoded chassis conditions.':'Candidate — requires verification.'):'No applicable match in the imported applications.')));}
 appendPartApplications();
};
function appendPartApplications(){
 for(const row of partRows.slice(partOffset,partOffset+50)){
  const card=document.createElement('article');card.className='card';card.append(text('h3',row.model+' · PNC '+row.pnc),text('p','Classification: '+(row.classifications||'No classification restriction recorded')),text('p','Production '+(row.start_period??'open')+'–'+(row.end_period??'open')),text('p',row.qualifier?'Option: '+row.qualifier+' · '+(r.pack.qualifierDescriptions[row.qualifier]||'Description unavailable'):'No option qualifier recorded'));
  if(row.combination_codes)card.append(text('p','Colour / interior combinations: '+row.combination_codes));
  card.append(text('small','Catalogue application; verify against the exact chassis before choosing a part.'));$('partSearchResults').append(card);
 }
 partOffset+=50;$('morePartResults').hidden=partOffset>=partRows.length;
}
$('morePartResults').onclick=appendPartApplications;


let catalogueDiagrams=[],browseCategory=null,browseSubgroup=null;
const asaCategories=[['Engine','11 12 13 14 15 16'],['PwrTrain','21 22 23 24 25 26 27 31 33 34 35 37'],['Body','42 43 51 52 53 61 91'],['Electrical','54 55']];
function categoryOf(d){return asaCategories.find(([,numbers])=>numbers.split(' ').includes(d.main_group))?.[0]||'Other';}
function subgroupLabel(d){return groupNames[v.model+'|'+d.main_group+'|'+d.sub_group]||('Group '+d.main_group+' / Subgroup '+d.sub_group);}
function renderCatalogueBrowser(){
 const container=$('groups');container.replaceChildren();
 if(!catalogueDiagrams.length){container.append(text('p','No applicable diagrams in the imported data.'));return;}
 const categories=[...asaCategories.map(([name])=>name),'Other'].filter(name=>catalogueDiagrams.some(d=>categoryOf(d)===name));
 if(!categories.includes(browseCategory))browseCategory=null;
 if(!browseCategory){
  container.append(text('h2','Browse catalogue'));const grid=document.createElement('div');grid.className='categoryGrid';
  for(const name of categories){const rows=catalogueDiagrams.filter(d=>categoryOf(d)===name),count=new Set(rows.map(d=>d.main_group+'|'+d.sub_group)).size;const button=text('button',name);button.append(text('small',count+' subgroups'));button.onclick=()=>{browseCategory=name;browseSubgroup=null;renderCatalogueBrowser();container.scrollIntoView({block:'start'});};grid.append(button);}
  container.append(grid);return;
 }
 const back=text('button',browseSubgroup?'Back to '+browseCategory:'Back to categories');back.onclick=()=>{if(browseSubgroup)browseSubgroup=null;else browseCategory=null;renderCatalogueBrowser();container.scrollIntoView({block:'start'});};container.append(back);
 const rows=catalogueDiagrams.filter(d=>categoryOf(d)===browseCategory);
 if(!browseSubgroup){
  container.append(text('h2',browseCategory));const grouped=new Map;
  for(const d of rows){const key=d.main_group+'|'+d.sub_group;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(d);}
  const grid=document.createElement('div');grid.className='subgroupGrid';
  for(const [key,diagrams] of [...grouped].sort(([a],[b])=>a.localeCompare(b))){const d=diagrams[0],button=text('button',subgroupLabel(d));button.append(text('small',d.main_group+'-'+d.sub_group+' · '+diagrams.length+' diagram'+(diagrams.length===1?'':'s')));button.onclick=()=>{browseSubgroup=key;draw(diagrams[0],diagrams,0);};grid.append(button);}
  container.append(grid);return;
 }
 const diagrams=rows.filter(d=>d.main_group+'|'+d.sub_group===browseSubgroup);
 if(!diagrams.length){browseSubgroup=null;renderCatalogueBrowser();return;}
 container.append(text('h2',subgroupLabel(diagrams[0])),text('p',browseCategory+' · '+diagrams[0].main_group+'-'+diagrams[0].sub_group));
 for(const d of diagrams){const button=document.createElement('button');button.className='diagramButton';if(r.pack.images[d.illustration_id]){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.src=imageURL(d.illustration_id);button.append(img);}const label=text('span',d.illustration_id);label.append(text('small',r.pack.images[d.illustration_id]?r.hotspots(d.illustration_id).length+' PNC hotspots':'Original image unavailable'));button.append(label);button.onclick=()=>draw(d,diagrams,diagrams.indexOf(d));container.append(button);}
}

try{db=await openDB();const storedNames=await readPack('groupNames');if(storedNames&&typeof storedNames==='object'&&!Array.isArray(storedNames))groupNames=storedNames;const preferences=await readPack('savedVehicles');savedVehicles=Array.isArray(preferences)?preferences.filter(x=>x&&typeof x.chassis==='string'&&/^[A-Z0-9]+-[0-9]{7}$/.test(x.chassis)&&typeof x.nickname==='string').map(x=>({chassis:x.chassis,nickname:x.nickname.slice(0,80)})):[];const saved=await readPack();if(saved)loaded(saved)}catch(e){$('importStatus').textContent='Local storage unavailable: '+e.message}
if('serviceWorker' in navigator && window.isSecureContext){
 $('offlineStatus').textContent='Preparing app for offline use…';
 try{
  await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  $('offlineStatus').textContent='App saved for offline use. Import your catalogue here, then test in airplane mode.';
 }catch(e){$('offlineStatus').textContent='Offline setup failed. Reopen with internet access before testing offline.';}
}else{$('offlineStatus').textContent='Offline installation needs a secure web address.';}


