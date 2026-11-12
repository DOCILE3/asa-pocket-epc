/* Resources for the existing generic-data installer. */
window.ASA_GENERIC_V81 = (() => {
  const configUrl = './generic-v81-layout.json';
  let config;
  let active = null;
  let generation = 0;

  async function layout() {
    if (!config) {
      const response = await fetch(configUrl, {cache: 'no-store'});
      if (!response.ok) throw new Error('Generic v8.1 layout is unavailable.');
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const identity = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (identity !== '49501d5125f7654b28ef361ebef7dc56d670771d8637e2f844abdfa3dc5c5893') throw new Error('Generic v8.1 layout identity mismatch.');
      config = JSON.parse(new TextDecoder().decode(bytes));
    }
    return config;
  }

  async function inspect(file, digest) {
    const pin = await layout();
    if (file.size !== pin.bytes) throw new Error('Generic v8.1 file size differs from the pinned candidate.');
    for (const [index, expected] of pin.chunks.entries()) {
      const start = index * pin.chunkBytes;
      const bytes = await file.slice(start, start + pin.chunkBytes).arrayBuffer();
      if (await digest(bytes) !== expected) throw new Error('Generic v8.1 candidate failed its integrity check.');
    }
    const [start, length] = pin.entries['browse.zip'];
    return {browse: file.slice(start, start + length), identity: pin.sha256, pin};
  }

  async function prepare(pack) {
    if (!pack?.genericBlob) return null;
    const pin = pack.genericLayout;
    if (!pin || pack.id !== pin.sha256 || pack.genericBlob.size !== pin.bytes) throw new Error('Stored generic pack identity is unavailable.');
    const dataset = {blob: pack.genericBlob, entries: pin.entries, models: pin.models};
    const names = await jsonResource('names.gz', dataset);
    return {...dataset, names: names.names};
  }

  function publish(dataset) {
    active = dataset;
    generation++;
    window.dispatchEvent(new Event('asa-generic-dataset-changed'));
  }

  function resource(path, dataset = active, type) {
    const range = dataset?.entries[path];
    if (!range) return null;
    const [start, length] = range;
    return dataset.blob.slice(start, start + length, type);
  }

  async function jsonResource(path, dataset = active) {
    const blob = resource(path, dataset);
    if (!blob) throw new Error('Missing generic resource: ' + path);
    const stream = path.endsWith('.gz') ? blob.stream().pipeThrough(new DecompressionStream('gzip')) : blob.stream();
    return new Response(stream).json();
  }

  function projectDisplayRow(row) {
    const printable = value => typeof value === 'string' && /^[ -~]+$/.test(value) && !/[^ -~]/.test(value);
    const display = {...row};
    for (const field of ['partSpec', 'partSpecJapanese']) {
      if (row[field] != null && !printable(row[field])) {
        display[field] = null;
        display[field + 'Omission'] = /[\x00-\x1f\x7f]/.test(row[field])
          ? 'control_character' : 'unsafe_or_empty_text';
      }
    }
    return display;
  }

  async function partRows(key) {
    const shard = [...new TextEncoder().encode(key)].reduce((sum, byte) => sum + byte, 0) % 256;
    const blob = resource('parts/' + shard + '.jsonl.gz');
    if (!blob) throw new Error('Generic part display shard is unavailable.');
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return (await new Response(stream).text()).split('\n').filter(Boolean).map(JSON.parse).filter(row => row.key === key).map(projectDisplayRow);
  }

  return {inspect, prepare, publish, resource, jsonResource, partRows, get active() {return active;}, get generation() {return generation;}};
})();
