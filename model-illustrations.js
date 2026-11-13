(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const container = $('groups');
  const modelSelect = $('generic_model');
  if (!container || !modelSelect) return;
  $('modelIllustrationBrowse')?.remove();
  const routeCache = new Map(), imageCache = new Map(), partCache = new Map();
  let compactThumbnailIndex;
  let modelNames = [];
  let browseGeneration = 0;
  const generic = window.ASA_GENERIC_V81;
  const urls = new Map();
  window.addEventListener('asa-generic-dataset-changed', () => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  });
  function imageUrl(id) {
    if (!generic.active) return '/__asa_illustrations__/' + encodeURIComponent(id);
    if (!urls.has(id)) {
      const blob = generic.resource('images/' + id + '.png', generic.active, 'image/png');
      if (!blob) return '';
      urls.set(id, URL.createObjectURL(blob));
      if (urls.size > 512) {
        const oldest = urls.keys().next().value;
        URL.revokeObjectURL(urls.get(oldest));
        urls.delete(oldest);
      }
    }
    return urls.get(id);
  }
  function subgroupName(model, group, subgroup) {
    return generic.active?.names[model + '|' + group + '|' + subgroup] || 'Group ' + group + ' / Subgroup ' + subgroup;
  }
  const categories = [['Engine', ['11','12','13','14','15','16']], ['PwrTrain', ['21','22','23','24','25','26','27','31','33','34','35','37']], ['Body', ['42','43','51','52','53','61','91']], ['Electrical', ['54','55']]];
  const text = (tag, value, cls) => { const e = document.createElement(tag); e.textContent = value; if (cls) e.className = cls; return e; };
  const shardFor = key => [...new TextEncoder().encode(key)].reduce((a,b)=>a+b,0) % 64;
  async function gzipJson(url) {
    const response = await fetch(url, {cache:'force-cache', credentials:'same-origin'});
    if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
    if (!response.body || !('DecompressionStream' in window)) throw new Error('This browser cannot open the compressed source data.');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  }
  async function loadModel(model) {
    if (generic.active) return (await generic.jsonResource("routes/" + model + ".json.gz")).routes;
    if (!routeCache.has(model)) routeCache.set(model, gzipJson(`./data/models/${encodeURIComponent(model)}.json.gz`).then(d => {
      if (d.schema !== 'asa-model-illustration-routes-v1' || d.model !== model || !Array.isArray(d.routes)) throw new Error('The model illustration routes failed their structure check.');
      return d.routes;
    }));
    return routeCache.get(model);
  }
  async function loadCompactThumbnail(group, subgroup) {
    if (generic.active) return (await generic.jsonResource("thumbnails.json")).mapping[group + "|" + subgroup] || null;
    if (!compactThumbnailIndex) compactThumbnailIndex = fetch('./data/compact-thumbnails.json', {cache:'force-cache', credentials:'same-origin'}).then(async r => {
      if (!r.ok) throw new Error(`Compact thumbnail index failed (HTTP ${r.status}).`);
      const d = await r.json();
      if (d.schema !== 'asa-compact-category-thumbnail-index-v1' || d.compact_asset_count !== 261 || d.compact_key_count !== 250 || d.source_pack_manifest_sha256 !== 'ccb27697e6254af0012b943e3d023495619a9634bacb34b081420c28a5950fdf' || d.source_model_route_map_sha256 !== 'e1622af15df23969de900f20659c0cfad4fa82a6ff483bb9bfd162fd837cecea') throw new Error('Compact thumbnail index identity or coverage is invalid.');
      return d.mapping;
    });
    const mapping = await compactThumbnailIndex;
    return mapping[`${group}|${subgroup}`] || null;
  }
  async function loadImage(id) {
    if (generic.active) {
      const data = await generic.jsonResource('hotspots/' + id + '.json.gz');
      const path = 'overlay/' + id + '.json.gz';
      if (generic.resource(path)) data.hotspots = await generic.jsonResource(path);
      return data;
    }
    const shard = shardFor(id);
    if (!imageCache.has(shard)) imageCache.set(shard, gzipJson(`./data/illustrations/image-data-${String(shard).padStart(2,'0')}.json.gz`));
    const data = await imageCache.get(shard);
    if (!data[id]) throw new Error(`No source hotspot record was found for ${id}.`);
    return data[id];
  }
  async function loadParts(key) {
    if (generic.active) return generic.partRows(key);
    const shardNo = shardFor(key);
    if (!partCache.has(shardNo)) partCache.set(shardNo, gzipJson(`/__asa_source_parts__/part-results-${String(shardNo).padStart(2,'0')}.json.gz`));
    const shard = await partCache.get(shardNo);
    return shard[key] || [];
  }
  function categoryFor(route) { return categories.find(([, codes]) => codes.includes(route.group))?.[0] || 'Other'; }
  function grouped(rows, keyFn) { const map = new Map(); for (const r of rows) { const key=keyFn(r); if(!map.has(key))map.set(key,[]); map.get(key).push(r); } return map; }
  function setStatus(message, error=false) { const s=$('genericStatus'); if(s){s.textContent=message;s.dataset.state=error?'error':'ok';} }
  function appendTilePreview(button, group, subgroup) {
    if (!group || !subgroup) return;
    const img = document.createElement('img');
    img.className = 'browseTileThumbnail';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.group = group;
    img.dataset.subgroup = subgroup;
    img.onerror = () => img.remove();
    button.append(img);
    loadCompactThumbnail(group, subgroup).then(entry => {
      if (!entry) { img.remove(); return; }
      img.src = imageUrl(entry.canonical_illustration_id);
      img.title = `${group}-${subgroup} compact ASA source artwork`;
    }).catch(() => img.remove());
  }
  function renderCategories(model, routes) {
    container.dataset.catalogueOwner = 'generic';
    container.replaceChildren();
    const dedup = [...new Map(routes.map(r=>[`${r.catalogue}|${r.model}|${r.group}|${r.subgroup}|${r.illustration}`,r])).values()];
    if (!dedup.length) { container.append(text('p', `${model}: no model-to-illustration routes are listed.`)); return; }
    container.append(text('h2', 'Browse catalogue'));
    container.append(text('p', `${model} · source illustration routes. This is model/catalogue navigation, not chassis-number fitment. Tiles use compact 294×162 ASA source artwork matched by group/subgroup code. Category tiles use a representative compact subgroup image; exact category-level selection and ASA runtime behavior are not asserted.`));
    const names=[...categories.map(([n])=>n),'Other'].filter(n=>dedup.some(r=>categoryFor(r)===n));
    const grid=text('div','','categoryGrid');
    for(const name of names){const rows=dedup.filter(r=>categoryFor(r)===name);const btn=document.createElement('button');btn.className='browseImageTile categoryImageTile';appendTilePreview(btn,rows[0]?.group,rows[0]?.subgroup);const copy=text('span',name,'browseTileCopy');copy.append(text('small',`${new Set(rows.map(r=>`${r.group}|${r.subgroup}`)).size} subgroups`));btn.append(copy);btn.onclick=()=>renderSubgroups(model,name,rows);grid.append(btn);}
    container.append(grid);
  }
  function renderSubgroups(model, name, rows) {
    const back = text('button','‹ Back to categories');
    back.id = 'browseBack';
    back.onclick = () => {
      container.replaceChildren(...previous.nodes);
      window.scrollTo(previous.x, previous.y);
    };
    const previous = {nodes:[...container.childNodes], x:window.scrollX, y:window.scrollY};
    container.replaceChildren(back,text('h2',name));
    const grid=text('div','','subgroupGrid');
    for(const [key, routes] of grouped(rows,r=>`${r.group}|${r.subgroup}`)){
      const [group,subgroup]=key.split('|');
      const button=document.createElement('button');button.className='browseImageTile subgroupImageTile';appendTilePreview(button,group,subgroup);const copy=text('span',subgroupName(model,group,subgroup),'browseTileCopy');copy.append(text('small',`${new Set(routes.map(r=>r.illustration)).size} illustrations`));button.append(copy);
      button.onclick=()=>openSeries(routes); grid.append(button);
    }
    container.append(grid);
    container.scrollIntoView({block:'start'});
  }
  function openSeries(routes) {
    const series = [...grouped(routes, route => route.illustration)]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([illustration_id, sources]) => ({illustration_id, sources}));
    window.ASA_GENERIC_VIEWER.open(series, {
      async load(diagram) {
        const id = diagram.illustration_id;
        const data = await loadImage(id);
        const [width, height] = data.dimensions;
        const url = imageUrl(id);
        if (!url || !(width > 0 && height > 0)) throw new Error('Source illustration unavailable.');
        return {url, width, height, hotspots:(data.hotspots || []).map(h => ({...h,width:h.w,height:h.h}))};
      },
      lookup(diagram, hotspot, details) {
        return showHotspot(hotspot, diagram.sources, details);
      }
    });
  }
  function appendPartRows(parent,key,rows){
    if(!rows.length){parent.append(text('p',`No exact source part row for ${key}. This does not establish that the part is inapplicable.`));return;}
    for(const row of rows){const card=text('article','', 'illustrationPartCard');card.append(text('strong',`${row.partNumber||row.part_no||'Part number unavailable'} · PNC ${key.split('|').at(-1)}`));if(row.quantity!=null||row.qty!=null)card.append(text('p',`Quantity: ${row.quantity??row.qty}`));if ('colour' in row) {
      card.append(text('p', 'Part name: ' + (row.partName ?? 'Unavailable')));
      card.append(text('p', 'Part spec: ' + (row.partSpec ?? 'Unavailable')));
      if (row.partSpecJapanese) card.append(text('p', 'Part spec (Japanese locale): ' + row.partSpecJapanese));
      card.append(text('p', 'Colour: ' + (row.colour ?? 'Unavailable')));
    }if(row.family)card.append(text('p',`Source: ${row.family}`));if(row.sourcePeriod||row.productionPeriod)card.append(text('p',`Source period: ${row.sourcePeriod||row.productionPeriod}`));if(row.sourcePath||row.sourceOffset!=null)card.append(text('small',`${row.sourcePath||''}${row.sourceOffset!=null?` · offset ${row.sourceOffset}`:''}`));parent.append(card);}
  }
  async function showHotspot(hotspot,routes,details){
    details.replaceChildren();details.append(text('h3',`PNC ${hotspot.pnc}`),text('p',`Recorded hotspot rectangle: x=${hotspot.x}, y=${hotspot.y}, width=${hotspot.w}, height=${hotspot.h}. Geometry layer: ${hotspot.layer || 'recorded source'}.`));
    const unique=[...new Map(routes.map(r=>[`${r.catalogue}|${r.model}|${hotspot.pnc}`,r])).values()];
    for(const route of unique){const key=`${route.catalogue}|${route.model}|${hotspot.pnc}`;details.append(text('h4',`Source part rows · ${key}`));try{appendPartRows(details,key,await loadParts(key));}catch(e){details.append(text('p',`Part lookup failed: ${e.message}`));}}
  }
  async function renderModel(model, isCurrent = () => true){
    const request = ++browseGeneration;
    const current = () => request === browseGeneration && isCurrent();
    if(!model||!(generic.active?.models ?? modelNames).includes(model)){container.replaceChildren();return;}
    try{const routes=await loadModel(model);if(current())renderCategories(model,routes);}
    catch(e){if(current()){container.replaceChildren(text('p',`Illustration routes unavailable: ${e.message}`));setStatus(e.message,true);}}
  }
  async function openPart(model,catalogue,pnc){
    try{
      const routes=(await loadModel(model)).filter(r=>r.catalogue===catalogue&&r.model===model);
      const ids=[...new Set(routes.map(r=>r.illustration))],matches=[];
      for(const id of ids){const data=await loadImage(id);if((data.hotspots||[]).some(h=>h.pnc===pnc))matches.push(...routes.filter(r=>r.illustration===id));}
      if(!matches.length){renderCategories(model,routes);setStatus(`${model} · ${catalogue} · PNC ${pnc}: no matching model/catalogue illustration hotspot is present in the candidate routes. No image relationship is inferred.`);container.scrollIntoView({block:'start'});return;}
      openSeries(matches);
    }catch(e){setStatus(`Could not open illustration: ${e.message}`,true);}
  }
  window.ASA_RENDER_MODEL_CATEGORIES=renderModel;
  window.ASA_CLEAR_GENERIC_CATALOGUE = () => {
    browseGeneration++;
    window.ASA_GENERIC_VIEWER?.close();
    if (container.dataset.catalogueOwner === 'generic') {
      container.replaceChildren();
      delete container.dataset.catalogueOwner;
    }
  };
  window.addEventListener('asa-generic-dataset-changed', () => {
    browseGeneration++;
    window.ASA_GENERIC_VIEWER?.close(false);
  });
  window.ASA_OPEN_SOURCE_PART_ILLUSTRATION=openPart;
  window.addEventListener('asa-general-model-filters-ready',()=>{});
  fetch('./data/illustration-models.json',{cache:'force-cache',credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error(`Model illustration index failed (HTTP ${r.status}).`);return r.json();}).then(d=>{
    if(d.schema!=='asa-model-illustration-model-list-v1'||d.sourceInteractionSha256!=='54dfa16dd0c0281b17ca9a8f441be2bb15e0ede0eaa7aef83b9205faf9388054'||d.models?.length!==436)throw new Error('Model illustration index identity or coverage is invalid.');
    modelNames=d.models;window.ASA_ILLUSTRATION_MODELS=modelNames;
  }).catch(e=>setStatus(e.message,true));
})();
