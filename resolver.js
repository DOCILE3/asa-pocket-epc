export const tokens = s => new Set((s||'').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
export function createResolver(pack) {
 const t=pack.tables, group=(rows,key)=>{const m=new Map;for(const r of rows){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return m};
 const applications=group(t.part_applications,r=>r.model), hotspots=group(t.hotspots,r=>r.illustration_id), memberships=group(t.model_illustrations,r=>r.model);
 const unresolved=new Set(t.vehicle_option_resolution.filter(r=>r.status==='unresolved_no_exact_opc_branch').map(r=>r.vehicle_id));
 const options=v=>{const o=tokens(v.option_ids);if(v.model==='H56A'&&['0SS','1SS'].includes(v.opc))o.add('N77');if(v.model==='CD5W'&&['00E','00G','0GE','0GG'].includes(v.opc)&&['LNHE','LRHE'].includes(v.classification)&&v.production_period>=1999061&&v.production_period<=2000033)o.add('J44');if(v.model==='H58A')for(const [id,opcs]of Object.entries(pack.h58Supplements))if(opcs.includes(v.opc))o.add(id);return o};
 const unknown=v=>unresolved.has(v.id);
 function dimensions(row,v,cls=row.classifications){const classes=tokens(cls);if(classes.size&&!classes.has(v.classification))return false;if(v.production_period!=null){if(row.start_period!=null&&v.production_period<row.start_period)return false;if(row.end_period!=null&&v.production_period>row.end_period)return false}return true}
 function match(row,v,ignoreQualifier=false){if(!dimensions(row,v))return false;if(!ignoreQualifier&&row.qualifier&&!options(v).has(row.qualifier))return false;const combo=tokens(row.combination_codes);return !combo.size||combo.has((v.exterior+v.interior).toUpperCase())}
 function expression(row,v){if(unknown(v))return true;const o=options(v);return (row.opc_expression||'').toUpperCase().split(/[ ,;]+/).filter(Boolean).every(s=>s.startsWith('-')?!o.has(s.slice(1)):o.has(s.replace(/^\+/,'')))}
 function lookup(v,pnc){if(v.generic)return genericLookup(v,pnc);const raw=(applications.get(v.model)||[]).filter(r=>r.pnc===pnc),fits=raw.filter(r=>match(r,v)),potential=unknown(v)?raw.filter(r=>r.qualifier&&match(r,v,true)):[];const qualified=fits.filter(r=>r.qualifier);const selected=qualified.length?qualified:[...fits.filter(r=>!r.qualifier),...potential];const seen=new Set;const parts=selected.filter(r=>!seen.has(r.part_number)&&seen.add(r.part_number)).map(r=>({...r,exact:!unknown(v)&&((r.start_period==null&&r.end_period==null)||v.production_period!=null)}));return{status:!raw.length?'notImported':!parts.length?'notApplicable':'applicable',parts,diagnostic:t.pnc_import_diagnostics.find(r=>r.model===v.model&&r.pnc===pnc)}}
 function diagrams(v){if(v.generic)return genericDiagrams(v);const ms=memberships.get(v.model)||[],allowed=new Set;for(const m of ms){for(const row of t.illustration_applications.filter(r=>r.model===v.model&&r.illustration_id===m.illustration_id)){if(dimensions(row,v)&&dimensions({},v,m.classifications)&&expression(row,v))allowed.add(m.illustration_id)}}const pncs=new Set((applications.get(v.model)||[]).filter(r=>match(r,v)||(unknown(v)&&r.qualifier&&match(r,v,true))).map(r=>r.pnc));const relevant=new Set([...allowed].filter(id=>(hotspots.get(id)||[]).some(h=>pncs.has(h.pnc))));const ids=relevant.size?relevant:allowed;return ms.filter(m=>ids.has(m.illustration_id)&&hierarchy(v,m)).map(m=>({...m,...t.illustrations.find(r=>r.illustration_id===m.illustration_id)}))}
 // Reference navigation uses original illustration conditions, not browse-menu eligibility.
 function referenceDiagrams(v,main,sub){
  if(v.generic)return genericDiagrams(v).filter(m=>{const code=m.illustration_id.match(/^\d(\d{2})_(\d{3})/);return code&&code[1]===main&&code[2]===sub;});
  const seen=new Set;
  return (memberships.get(v.model)||[]).filter(m=>{
   const code=m.illustration_id.match(/^\d(\d{2})_(\d{3})/);
   if(!code||code[1]!==main||code[2]!==sub||seen.has(m.illustration_id))return false;
   const rows=t.illustration_applications.filter(row=>row.model===v.model&&row.illustration_id===m.illustration_id);
   if(!rows.some(row=>dimensions(row,v)&&expression(row,v)))return false;
   seen.add(m.illustration_id);return true;
  }).map(m=>({...m,...t.illustrations.find(row=>row.illustration_id===m.illustration_id),main_group:main,sub_group:sub}));
 }
 function hierarchy(v,m){return ['M','S'].every(level=>{const rows=t.hierarchy_applications.filter(r=>r.model===v.model&&r.level===level&&r.main_group===m.main_group&&r.sub_group===(level==='M'?'':m.sub_group));return !rows.length||rows.some(r=>dimensions(r,v)&&expression(r,v))})}
 const genericContextCache=new WeakMap;function genericContexts(v){if(!genericContextCache.has(v))genericContextCache.set(v,t.vehicles.filter(row=>Object.entries(v.filters).every(([key,value])=>!value||row[key]===value)));return genericContextCache.get(v);}
 function genericMatch(row,v){
  const f=v.filters;if(f.model&&row.model!==f.model)return false;
  const classes=tokens(row.classifications);if(f.classification&&classes.size&&!classes.has(f.classification))return false;
  if(f.opc||f.exterior||f.interior){
   return genericContexts(v).some(vehicle=>vehicle.model===row.model&&(!classes.size||classes.has(vehicle.classification))&&(!tokens(row.combination_codes).size||tokens(row.combination_codes).has((vehicle.exterior+vehicle.interior).toUpperCase())));
  }
  return true;
 }
 function genericLookup(v,pnc){
  const raw=t.part_applications.filter(row=>row.pnc===pnc&&(!v.filters.model||row.model===v.filters.model));
  const seen=new Set,parts=raw.filter(row=>genericMatch(row,v)).filter(row=>!seen.has(row.part_number)&&seen.add(row.part_number)).map(row=>({...row,exact:false}));
  return {status:!raw.length?'notImported':parts.length?'applicable':'notApplicable',parts};
 }
 function genericDiagrams(v){
  const seen=new Set;
  return t.model_illustrations.filter(m=>{
   if(seen.has(m.illustration_id)||!genericMatch(m,v))return false;
   const rows=t.illustration_applications.filter(row=>row.model===m.model&&row.illustration_id===m.illustration_id);
   if(rows.length&&!rows.some(row=>genericMatch(row,v)))return false;
   seen.add(m.illustration_id);return true;
  }).map(m=>({...m,...t.illustrations.find(row=>row.illustration_id===m.illustration_id)}));
 }
 function search(q){q=q.trim().toUpperCase().replace(/\s/g,'');const m=q.match(/^([A-Z0-9]+)-(\d{1,7})$/);if(m)q=m[1]+'-'+m[2].padStart(7,'0');return t.vehicles.filter(v=>(v.model+'-'+v.serial_number).includes(q)).slice(0,100)}
 return{search,options,unknown,lookup,diagrams,referenceDiagrams,hotspots:id=>hotspots.get(id)||[],pack};
}

