(() => {
  const $ = id => document.getElementById(id);
  const workspace = $('workspace');
  const genericDetails = $('genericBrowse');
  const legacyGeneric = $('genericSearch');
  const dataPanel = $('dataPanel');
  if (!workspace || !genericDetails || !legacyGeneric || !dataPanel) return;

  const el = (tag, attrs = {}, label = '') => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    }
    if (label) node.textContent = label;
    return node;
  };
  const style = el('style');
  style.textContent = '.generic-only .chassisOnly,.generic-only #partSearch{display:none!important}.splitPackCard{border-top:1px solid var(--line,#39434c);margin-top:18px;padding-top:16px}:root[data-theme="light"] #sourceModelSearchForm select{background:var(--asa-light-surface);color:var(--asa-light-text);border-color:var(--asa-light-border)}';
  document.head.append(style);

  // Keep the chassis catalogue and the generic source in separate import paths.
  const genericInput = el('input', {id:'sourcePackFile', class:'fileInput', type:'file', accept:'.zip,application/zip', 'aria-label':'Choose Generic Search data pack'});
  document.body.append(genericInput);
  const genericSettings = el('section', {id:'genericPackSettings', class:'splitPackCard'});
  genericSettings.append(el('h3', {text:'Generic Search Data Pack'}));
  const genericSummary = el('div', {id:'genericPackSummary', class:'settingsInfo', text:'No Generic Search Data Pack imported on this device.'});
  genericSettings.append(genericSummary);
  const settingsActions = el('div', {class:'settingsPackActions'});
  const importButton = el('button', {type:'button', class:'settingsPrimary', 'aria-label':'Import Data Pack for Generic Search', text:'Import Data Pack'});
  const removeButton = el('button', {id:'genericPackRemove', type:'button', class:'settingsPrimary', disabled:'disabled', 'aria-label':'Remove Data Pack for Generic Search', text:'Remove Data Pack'});
  importButton.addEventListener('click', () => genericInput.click());
  settingsActions.append(importButton, removeButton);
  genericSettings.append(settingsActions);
  const namesSummary = $('settingsGroupSummary');
  const namesHeading = namesSummary?.previousElementSibling;
  const namesButton = $('settingsImportNames');
  if (namesHeading) namesHeading.hidden = true;
  if (namesSummary) namesSummary.hidden = true;
  if (namesButton) namesButton.hidden = true;
  namesHeading?.parentElement?.insertBefore(genericSettings, namesHeading);

  const genericPanel = el('section', {id:'genericPackWorkspace', class:'partSearchLayout'});
  genericPanel.hidden = true;
  const missingPrompt = el('div', {id:'genericPackMissing', class:'settingsInfo', text:'Install a Generic Search Data Pack in Settings to browse models, group names and source part rows.'});
  const missingSettings = el('button', {type:'button', text:'Open Data Pack settings'});
  missingSettings.addEventListener('click', () => { $('settings').click(); $('dataTab').click(); });
  missingPrompt.append(missingSettings);
  genericDetails.append(missingPrompt);
  const controls = el('div', {id:'sourcePackControls', hidden:'hidden'});
  const hiddenHosted = el('button', {id:'hostedBrowsePack', type:'button', hidden:'hidden'});
  const status = el('p', {id:'sourcePackStatus', class:'settingsInfo', role:'status', text:'Checking for an installed Generic Search Data Pack…'});
  const removeGeneric = el('button', {id:'removeSourcePack', type:'button', hidden:'hidden', text:'Remove Generic Search Data Pack'});
  controls.append(hiddenHosted, status, removeGeneric);
  genericSettings.append(controls);

  const searchForm = el('form', {id:'sourceModelSearchForm'});
  const fields = el('div', {class:'genericFields'});
  const modelLabel = el('label', {for:'sourceModel', text:'Model'});
  const model = el('select', {id:'sourceModel', 'aria-label':'Generic Search model'});
  model.add(new Option('Choose model', ''));
  modelLabel.append(model);
  const classLabel = el('label', {for:'sourceClassFilter', text:'Classification'});
  const classification = el('select', {id:'sourceClassFilter', disabled:'disabled'});
  classification.add(new Option('Any', ''));
  classLabel.append(classification);
  fields.append(modelLabel, classLabel);
  for (const [id, title] of [['sourceOption','Option'],['sourceExterior','Exterior'],['sourceInterior','Interior']]) {
    const label = el('label', {for:id, text:title});
    const select = el('select', {id, disabled:'disabled', 'aria-label':title + ' (unavailable in this pack)'});
    select.add(new Option('', ''));
    label.append(select);
    fields.append(label);
  }
  const browseActions = el('div', {class:'vehicleActions'});
  browseActions.append(
    el('button', {type:'submit', text:'Browse selection'}),
    el('button', {id:'sourceBrowseClear', type:'reset', class:'resetButton', text:'Clear'})
  );
  searchForm.append(el('p', {text:'Browse model-level parts without a chassis number.'}), fields, browseActions,
    el('p', {id:'sourceBrowseStatus', role:'status', hidden:'hidden'}));
  const searchRoot = el('div', {id:'sourceModelSearch'});
  searchRoot.append(searchForm);
  genericDetails.append(searchRoot);

  genericPanel.append(el('h2', {text:'Find a part'}));
  const partForm = el('form', {id:'genericPackPartForm'});
  const numberLabel = el('label', {for:'genericPartNumber', text:'Mitsubishi part number or PNC'});
  const number = el('input', {id:'genericPartNumber', type:'search', required:'required', maxlength:'40', autocomplete:'off', autocapitalize:'characters', placeholder:'MR166160'});
  const findPart = el('button', {id:'genericPartSubmit', type:'submit', class:'searchAction', text:'Find part'});
  const searchRow = el('div', {class:'search'});
  searchRow.append(number, findPart);
  partForm.append(numberLabel, searchRow);
  const cancelPart = el('button', {id:'genericPartCancel', type:'button', hidden:'hidden', text:'Cancel search'});
  genericPanel.append(partForm, el('p', {id:'genericPartStatus', role:'status'}), cancelPart);
  genericPanel.append(el('div', {id:'genericPartResults'}));
  const illustration = el('section', {id:'modelIllustrationBrowse', class:'sourceModelBrowse illustrationBrowse', hidden:'hidden'});
  illustration.append(el('h3', {text:'Illustrations for selected model'}));
  illustration.append(el('p', {text:'Choose a group, subgroup and illustration. Group labels come from the Generic Search Data Pack. Results are model-level, not chassis-number fitment.'}));
  const illustrationFields = el('div', {class:'genericFields'});
  for (const [id, title, first] of [['illustrationGroup','Main group','Choose group'],['illustrationSubgroup','Subgroup','Choose subgroup'],['illustrationDiagram','Illustration','Choose illustration']]) {
    const label = el('label', {for:id, text:title});
    const select = el('select', {id, disabled:'disabled'});
    select.add(new Option(first, ''));
    label.append(select); illustrationFields.append(label);
  }
  illustration.append(illustrationFields, el('p', {id:'illustrationBrowseStatus', role:'status', text:'Choose a model above.'}));
  const viewer = el('div', {id:'illustrationViewer', hidden:'hidden'});
  viewer.append(el('p', {id:'illustrationCaption', class:'illustrationCaption'}), el('div', {id:'illustrationImageFrame', class:'illustrationImageFrame'}), el('div', {id:'illustrationPartResult', 'aria-live':'polite'}));
  illustration.append(viewer); genericPanel.append(illustration);
  const legacyPartSearch = $('partSearch');
  legacyPartSearch.before(genericPanel);
  legacyGeneric.hidden = true;
  legacyPartSearch.hidden = true;

  const updatePackControls = () => {
    const ready = !!model.options[1];
    genericPanel.hidden = !ready;
    missingPrompt.hidden = ready;
    searchRoot.hidden = !ready;
    genericSummary.textContent = ready ? status.textContent : 'No Generic Search Data Pack imported on this device.';
    removeButton.disabled = !ready;
  };
  new MutationObserver(() => { updatePackControls(); setTimeout(updateHome, 0); }).observe(model, {childList:true});
  new MutationObserver(updatePackControls).observe(status, {childList:true, characterData:true, subtree:true});
  removeButton.addEventListener('click', () => window.ASA_REMOVE_BROWSE_PACK?.());

  for (const id of ['savedVehicles','searchForm']) $('workspace').querySelector('#'+id)?.classList.add('chassisOnly');
  const updateHome = () => {
    const genericReady = !!model.options[1];
    const dataLabel = $('dataStatus').textContent.trim();
    const chassisReady = /^ASA\s/.test(dataLabel) && !dataLabel.startsWith('Generic Search');
    document.body.classList.toggle('generic-only', genericReady && !chassisReady);
    if (genericReady && !chassisReady) {
      $('setup').hidden = true; $('settingsPage').hidden = true; workspace.hidden = false;
      document.body.classList.remove('settings-open');
      $('connection').textContent = navigator.onLine ? 'Generic Search Data Pack ready on this device' : 'Offline · Generic Search Data Pack available';
      if ($('dataStatus').textContent !== 'Generic Search Data Pack · model-level data') $('dataStatus').textContent = 'Generic Search Data Pack · model-level data';
    } else if (!genericReady && !chassisReady && !$('settingsPage').hidden) {
      $('setup').hidden = false; workspace.hidden = true;
    } else if (!genericReady && !chassisReady && $('setup').hidden) {
      $('setup').hidden = false; workspace.hidden = true;
    }
    updatePackControls();
  };
  new MutationObserver(updateHome).observe($('dataStatus'), {childList:true, characterData:true, subtree:true});
  window.addEventListener('asa-generic-dataset-changed', updateHome);
  window.addEventListener('asa-generic-dataset-changed', () => { setTimeout(updateHome, 0); });
  window.addEventListener('online', updateHome); window.addEventListener('offline', updateHome);
  setTimeout(updateHome, 0);

  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = () => reject(new Error('Could not load ' + src)); document.body.append(script);
  });
  (async () => {
    try {
      await loadScript('./generic-v81.js?v=2');
      await loadScript('./model-browse.js?v=10');
      await loadScript('./model-illustrations.js?v=6');
      updateHome();
    } catch (error) {
      genericSummary.textContent = 'Generic Search Data Pack features could not start: ' + error.message;
      status.textContent = genericSummary.textContent;
    }
  })();
})();
