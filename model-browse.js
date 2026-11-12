const EXPECTED = {
  manifestSha256: '8113cef079f3d2501982109092ba74ce088ddb704ddf370292287f625c5b32c2',
  sourceSha256: '58847ab733e98f04c6e6e4ba8538ea6af349a778423ecd381a3082099b2d6db3',
  archiveBytes: 183852660,
  rows: 1282060,
  models: 436,
  maxExpandedModelBytes: 31480925,
};

const $ = id => document.getElementById(id);
const DB_NAME = 'asa-pocket-generic-search-20261112-v1';
const DB_VERSION = 1;
const DB = openDb();
let activePack = null;
let partSearch = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the separate model-data store.'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local storage request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Local storage transaction failed.'));
  });
}

async function digest(bytes) {
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function inspectPack(file) {
  if (file.size !== EXPECTED.archiveBytes) throw new Error('This is not the pinned 436-model pack (file size does not match).');
  const tailStart = Math.max(0, file.size - 65557);
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  const entries = new Map();
  // Central directory offsets are absolute; parse the same small tail after translating the offset base.
  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= Math.max(0, tail.length - 65557); i--) if (tailView.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  const cdOffset = tailView.getUint32(eocd + 16, true);
  const cdBytes = tailView.getUint32(eocd + 12, true);
  if (cdOffset < tailStart || cdOffset + cdBytes > file.size) throw new Error('The ZIP directory is not in the supported bounded location.');
  const cdStartInTail = cdOffset - tailStart;
  let p = cdStartInTail;
  const total = tailView.getUint16(eocd + 10, true);
  for (let i = 0; i < total; i++) {
    const flags = tailView.getUint16(p + 8, true);
    const method = tailView.getUint16(p + 10, true);
    const size = tailView.getUint32(p + 20, true);
    const nameLen = tailView.getUint16(p + 28, true);
    const extraLen = tailView.getUint16(p + 30, true);
    const commentLen = tailView.getUint16(p + 32, true);
    const localOffset = tailView.getUint32(p + 42, true);
    const name = new TextDecoder().decode(tail.subarray(p + 46, p + 46 + nameLen));
    if (flags & 1 || method !== 0) throw new Error('The pack uses an unsupported entry type.');
    const localHeader = new Uint8Array(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    const localView = new DataView(localHeader.buffer);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error('The pack contains a damaged local file header.');
    const localNameLen = localView.getUint16(26, true);
    const localExtraLen = localView.getUint16(28, true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    if (start + size > cdOffset) throw new Error('The pack contains an invalid file range.');
    entries.set(name, { start, bytes: size });
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (entries.size !== EXPECTED.models + 1) throw new Error('The pack does not contain the expected model files.');
  const manifestEntry = entries.get('manifest.json');
  if (!manifestEntry || manifestEntry.bytes > 200000) throw new Error('The pinned manifest is missing or too large.');
  const manifestBytes = await file.slice(manifestEntry.start, manifestEntry.start + manifestEntry.bytes).arrayBuffer();
  if (await digest(manifestBytes) !== EXPECTED.manifestSha256) throw new Error('The pack manifest hash does not match the reviewed identity.');
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (manifest.format !== 'asa-model-browse-pack' || manifest.schema !== 1 || manifest.source_sha256 !== EXPECTED.sourceSha256 || manifest.source_rows !== EXPECTED.rows || manifest.source_models !== EXPECTED.models || manifest.source_catalogues !== 81 || manifest.record_filter?.family !== '02 FF' || manifest.record_filter?.E1 !== 'absent' || !Array.isArray(manifest.models) || manifest.models.length !== EXPECTED.models) {
    throw new Error('The pack identity, record scope, or model count is not the reviewed one.');
  }
  const modelNames = new Set();
  let rowSum = 0;
  for (const model of manifest.models) {
    if (!/^[A-Z0-9]{1,8}$/.test(model.model) || modelNames.has(model.model) || model.entry !== `models/${model.model}.jsonl.gz` || !Number.isInteger(model.rows) || model.rows <= 0 || model.expanded_bytes > EXPECTED.maxExpandedModelBytes || !/^[a-f0-9]{64}$/.test(model.sha256)) throw new Error('The pack model manifest contains an invalid entry.');
    const entry = entries.get(model.entry);
    if (!entry || entry.bytes !== model.compressed_bytes) throw new Error(`Model file is missing or has the wrong size: ${model.model}`);
    modelNames.add(model.model); rowSum += model.rows;
  }
  if (rowSum !== EXPECTED.rows || [...entries.keys()].some(name => name !== 'manifest.json' && !modelNames.has(name.slice('models/'.length, -'.jsonl.gz'.length)))) throw new Error('The model list does not match the expected source row set.');
  return { manifest, entries };
}

function setStatus(message, bad = false) {
  const node = $('sourcePackStatus');
  node.textContent = message;
  node.dataset.state = bad ? 'error' : 'ok';
}

function clearGenericResults() {
  partSearch?.abort();
  partSearch = null;
  $('genericPartStatus').textContent = '';
  $('genericPartSubmit').disabled = false;
  $('genericPartCancel').hidden = true;
  for (const id of ['results','groups','genericPartResults']) $(id)?.replaceChildren();
  if ($('modelIllustrationBrowse')) $('modelIllustrationBrowse').hidden = true;
  if ($('illustrationViewer')) $('illustrationViewer').hidden = true;
}

let installing = false;
async function installPack(file) {
  if (installing) return;
  installing = true;
  setStatus('Checking the selected generic-data download…');
  try {
    await initialLoad;
    const generic = file.size !== EXPECTED.archiveBytes;
    if (file.size > 1100 * 1024 * 1024) throw new Error('The selected generic file exceeds the candidate size limit.');
    if (!navigator.storage?.estimate) throw new Error('Available storage cannot be checked.');
    const {quota, usage = 0} = await navigator.storage.estimate();
    if (!Number.isFinite(quota) || quota - usage < file.size * 1.15) throw new Error('Insufficient reported storage to preserve the existing catalogue.');
    const composite = generic ? await window.ASA_GENERIC_V81.inspect(file, digest) : null;
    if (!composite) throw new Error('Choose the combined Generic Search Data Pack; the model-only archive does not include the bundled group labels.');
    const browse = composite ? composite.browse : file;
    const inspected = await inspectPack(browse);
    const id = composite ? composite.identity : EXPECTED.manifestSha256;
    const pack = {id, blob: browse, manifest: inspected.manifest, entries: Object.fromEntries(inspected.entries)};
    if (composite) {
      pack.genericBlob = file;
      pack.genericLayout = composite.pin;
    }
    const dataset = await window.ASA_GENERIC_V81.prepare(pack);
    const tx = (await DB).transaction(['packs', 'meta'], 'readwrite');
    const storedPack = composite ? {...pack, blob: undefined} : pack;
    tx.objectStore('packs').put(storedPack);
    tx.objectStore('meta').put({key: 'active', id});
    await transactionDone(tx);
    activePack = pack;
    window.ASA_GENERIC_V81.publish(dataset);
    clearGenericResults();
    updateUi();
  } catch (error) {
    setStatus('Not installed: ' + error.message + ' Existing catalogue data was left unchanged.', true);
  } finally {
    installing = false;
  }
}

window.ASA_INSTALL_BROWSE_PACK=installPack;$('hostedBrowsePack').addEventListener('click',async()=>{try{const {file}=await window.ASA_HOSTED_PACKS.getPinnedPack('generalBrowse','sourcePackStatus');await installPack(file)}catch{}});

async function loadActive() {
  try {
    const db = await DB;
    const active = await requestValue(db.transaction('meta', 'readonly').objectStore('meta').get('active'));
    activePack = active ? await requestValue(db.transaction('packs', 'readonly').objectStore('packs').get(active.id)) : null;
    if (activePack?.genericBlob) {
      const browse = activePack.genericLayout?.entries?.['browse.zip'];
      if (!Array.isArray(browse) || browse.length !== 2) throw new Error('Stored generic pack layout is incomplete.');
      activePack.blob = activePack.genericBlob.slice(browse[0], browse[0] + browse[1]);
      window.ASA_GENERIC_V81.publish(await window.ASA_GENERIC_V81.prepare(activePack));
    }
    else window.ASA_GENERIC_V81.publish(null);
  } catch (error) {
    activePack = null;
    window.ASA_GENERIC_V81.publish(null);
    setStatus(`Generic Search storage could not be opened: ${error.message}`, true);
  }
  updateUi();
}

function updateUi() {
  $('sourceModelSearch').hidden = !activePack;
  $('removeSourcePack').hidden = !activePack;
  const select = $('sourceModel');
  select.replaceChildren(new Option('Choose model', ''));
  if (activePack) {
    const displayScope = activePack.genericBlob ? " G4 display data is partial. Colour is unavailable, Japanese Part Name is excluded, and undecoded specs are omitted." : "";
    for (const item of activePack.manifest.models) select.add(new Option(`${item.model} (${item.rows.toLocaleString()} rows)`, item.model));
    setStatus(`Installed once: ${activePack.manifest.source_models.toLocaleString()} models · ${activePack.manifest.source_rows.toLocaleString()} model-level rows. Option remains fixed at 000; Exterior and Interior are unavailable in this export.${displayScope}`);
  } else {
    setStatus('Not installed. Choose the single 436-model download once; searches do not require selecting a file again.');
  }
}

async function* gzipLines(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      let at;
      while ((at = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, at); pending = pending.slice(at + 1);
        if (line.length > 65536) throw new Error('A source row exceeds the safe line limit.');
        if (line) yield line;
      }
      if (pending.length > 65536) throw new Error('A source row exceeds the safe line limit.');
      if (done) break;
    }
    if (pending) yield pending;
  } finally {
    try { await reader.cancel(); } catch {} finally { reader.releaseLock(); }
  }
}

function rawValue(value) {
  if (value == null) return 'not present';
  if (Array.isArray(value.items)) return `${value.items.map(item => item.value ?? item.raw_hex ?? JSON.stringify(item)).join(', ')} (raw count ${value.count_raw_hex || 'unknown'})`;
  if (Array.isArray(value)) return value.map(item => item.value ?? item.raw_hex ?? JSON.stringify(item)).join(', ');
  return value.value ?? value.raw_hex ?? JSON.stringify(value);
}

function getField(record, prefix) {
  const key = Object.keys(record.fields || {}).find(name => name.startsWith(prefix));
  return key ? record.fields[key] : null;
}


async function* readModelRows(pack, spec, signal) {
  signal?.throwIfAborted();
  const entry = pack.entries[spec.entry];
  if (!entry) throw new Error(`Model file missing for ${spec.model}.`);
  const compressed = await pack.blob.slice(entry.start, entry.start + entry.bytes).arrayBuffer();
  if (await digest(compressed) !== spec.sha256) throw new Error(`Model file failed its integrity check: ${spec.model}.`);
  let seen = 0;
  for await (const line of gzipLines(compressed)) {
    signal?.throwIfAborted();
    const record = JSON.parse(line).source_record;
    if (!record || record.record_type_subtype !== '02 FF' || record.field_presence_by_schema?.E1 !== false || record.explicit_key?.A2_Model !== spec.model) {
      throw new Error(`Source row failed validation for ${spec.model}.`);
    }
    seen++;
    yield record;
  }
  if (seen !== spec.rows) throw new Error(`Expected ${spec.rows} rows for ${spec.model}, read ${seen}.`);
}

function classificationValues(record) {
  return (getField(record, 'E2_Classification')?.items || []).map(item => item.value).filter(Boolean);
}

async function searchModel() {
  const pack = activePack;
  if (!pack) return setStatus('Install the Generic Search Data Pack first.', true);
  const modelName = $('sourceModel').value;
  if (!modelName) return setStatus('Choose a model to browse.', true);
  const selectedClass = $('sourceClassFilter').value;
  const spec = pack.manifest.models.find(item => item.model === modelName);
  if (!spec) return setStatus('The selected model is missing from the installed pack.', true);
  const out = $('results'); out.replaceChildren();
  setStatus(`Searching ${modelName} source rows…`);
  try {
    let shown = 0;
    for await (const record of readModelRows(pack, spec)) {
      if (pack !== activePack) return;
      if (!selectedClass || classificationValues(record).includes(selectedClass)) shown++;
    }
    if (pack !== activePack) return;
    setStatus(`${modelName}: ${shown.toLocaleString()} matching model-level source rows in this selection. Browse the catalogue categories below for available illustrations and recorded PNC hotspots. ${selectedClass ? "Filtered by raw E2 value " + selectedClass + ". " : ""}This is model-level routing, not chassis-number fitment. Source rows without a mapped illustration route are not shown.`);
    window.ASA_RENDER_MODEL_CATEGORIES?.(modelName);
  } catch (error) {
    if (pack !== activePack) return;
    out.replaceChildren();
    setStatus(`Search stopped: ${error.message}`, true);
  }
}

function normalPartCode(value) {
  return String(value ?? '').toUpperCase().replace(/[\s-]+/g, '');
}

function renderPartMatches(results, matches) {
  const list = document.createDocumentFragment();
  if (matches.length) {
    const note = document.createElement('p');
    note.textContent = 'Each model shows up to five matching part and PNC examples. Confirm fitment by chassis.';
    list.append(note);
  }
  for (const {model, count, examples} of matches) {
    const card = document.createElement('details');
    card.className = 'card';
    const heading = document.createElement('summary');
    heading.textContent = `${model} · ${count.toLocaleString()} matching rows`;
    card.append(heading);
    const rows = document.createElement('ul');
    for (const example of examples) {
      const row = document.createElement('li');
      row.textContent = example;
      rows.append(row);
    }
    card.append(rows);
    list.append(card);
  }
  results.replaceChildren(list);
}

async function findPartAcrossModels() {
  if (partSearch) return;
  const pack = activePack;
  const status = $('genericPartStatus');
  const results = $('genericPartResults');
  results.replaceChildren();
  const query = normalPartCode($('genericPartNumber').value);
  if (!query) {
    status.textContent = 'Enter a Mitsubishi part number or PNC.';
    return;
  }
  if (!pack) {
    status.textContent = 'Install the Generic Search Data Pack first.';
    return;
  }

  const search = new AbortController();
  partSearch = search;
  const {signal} = search;
  const submit = $('genericPartSubmit');
  const cancel = $('genericPartCancel');
  submit.disabled = true;
  cancel.hidden = false;
  const models = pack.manifest.models;
  const matches = [];
  let totalMatches = 0;
  try {
    for (const [index, spec] of models.entries()) {
      signal.throwIfAborted();
      status.textContent = `Searching ${spec.model} · ${index + 1} of ${models.length} models`;
      let count = 0;
      const examples = new Set();
      for await (const record of readModelRows(pack, spec, signal)) {
        const part = getField(record, 'D1_PartNumber')?.value;
        const pnc = record.explicit_key?.A1_PNC;
        if (!normalPartCode(part).includes(query) && !normalPartCode(pnc).includes(query)) continue;
        count++;
        if (examples.size < 5) examples.add([part, pnc && `PNC ${pnc}`].filter(Boolean).join(' · '));
      }
      if (count) {
        matches.push({model: spec.model, count, examples});
        totalMatches += count;
      }
    }
    signal.throwIfAborted();
    renderPartMatches(results, matches);
    status.textContent = matches.length
      ? `${totalMatches.toLocaleString()} matching rows in ${matches.length} of ${models.length} models for ${query}.`
      : `No matches for ${query} across all ${models.length} models.`;
  } catch (error) {
    if (partSearch !== search) return;
    status.textContent = signal.aborted ? 'Search cancelled.' : `Search incomplete: ${error.message}`;
  } finally {
    if (partSearch === search) {
      partSearch = null;
      submit.disabled = false;
      cancel.hidden = true;
    }
  }
}

async function removePack() {
  if (installing) return;
  if (!confirm('Remove the Generic Search Data Pack from this device? The Chassis Data Pack and saved vehicles stay installed.')) return;
  const db = await DB;
  const active = await requestValue(db.transaction('meta', 'readonly').objectStore('meta').get('active'));
  const tx = db.transaction(['packs', 'meta'], 'readwrite');
  if (active) tx.objectStore('packs').delete(active.id);
  tx.objectStore('meta').delete('active');
  await transactionDone(tx);
  activePack = null; window.ASA_GENERIC_V81.publish(null); clearGenericResults(); updateUi();
}

window.ASA_REMOVE_BROWSE_PACK = removePack;
$('sourcePackFile').addEventListener('change', event => {
  const file = event.target.files?.[0]; event.target.value = '';
  if (file) installPack(file);
});
$('sourceModelSearchForm').addEventListener('submit', event => { event.preventDefault(); searchModel(); });
$('genericPackPartForm').addEventListener('submit', event => { event.preventDefault(); findPartAcrossModels(); });
$('genericPartCancel').addEventListener('click', () => partSearch?.abort());
$('removeSourcePack').addEventListener('click', removePack);
async function loadFilterIndex() {
  try {
    const response = await fetch('./data/generalBrowse/model-filter-index.json', { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Model filter index download failed (HTTP ${response.status}).`);
    const bytes = await response.arrayBuffer();
    if (await digest(bytes) !== '08b0d252d1008657d51f31f0da8bf324c821891165e7ac9a173867b3e4acf223') throw new Error('Model filter index hash does not match the pinned source-derived index.');
    const index = JSON.parse(new TextDecoder().decode(bytes));
    if (index.schema !== 'asa-general-model-filter-index-v1' || index.source_pack_sha256 !== 'a69c051ed95991d0235e8f3a00a6a6fb6e7afaecf41cea50ad17b00337045b2c' || index.source_models !== 436 || index.source_rows !== 1282060 || index.models?.length !== 436) throw new Error('Model filter index identity or coverage is invalid.');
    window.ASA_GENERAL_MODEL_FILTERS = index.models;
    window.dispatchEvent(new CustomEvent('asa-general-model-filters-ready'));
  } catch (error) { setStatus(`Model list unavailable: ${error.message}`, true); }
}
loadFilterIndex();
const initialLoad = loadActive();
