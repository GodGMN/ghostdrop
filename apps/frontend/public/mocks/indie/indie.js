const indieConcepts = [
  {
    id: 'workbench',
    name: 'Workbench',
    tag: 'Graphite / ochre / compact',
    note: 'A small desktop instrument. An ochre tab, square controls and a deliberately dense file well. The brand lives in the wordmark and the proportions, rather than a hero illustration.',
  },
  {
    id: 'colophon',
    name: 'Colophon',
    tag: 'Typeset / spare / paper',
    note: 'A quiet independent publication translated into a file utility. Serif wordmark, black rules, tiny folio numbers and almost no color. The upload form is the whole page.',
  },
  {
    id: 'spool',
    name: 'Spool',
    tag: 'Steel blue / modular / precise',
    note: 'A storage tray with a blue tab and a clipped file corner. Visible edges, short labels and a horizontal file slot. The layout borrows from old desktop tools without imitating an operating system.',
  },
  {
    id: 'notice',
    name: 'Notice',
    tag: 'Ink / yellow / utilitarian',
    note: 'A printed notice pinned to a plain wall. One yellow label, a narrow black wordmark and an intentionally simple drop target. More independent workshop than startup landing page.',
  },
  {
    id: 'nightshift',
    name: 'Nightshift',
    tag: 'Black / restrained / typographic',
    note: 'A quiet dark utility. Gray rather than luminous color, with one rust-red registration mark. File details are left aligned and the sharing view behaves like an image viewer.',
  },
  {
    id: 'fieldnotes',
    name: 'Fieldnotes',
    tag: 'Olive / ruled / understated',
    note: 'A practical field notebook. A margin for short annotations, fine rules and an olive file tray. The small asymmetries give it character while the controls stay ordinary.',
  },
];
const original = document.body.dataset.collection === 'original';
const originalConcepts = [
  {
    id: 'inset',
    name: 'Inset',
    tag: 'A dark file tray / soft edges',
    note: 'Keep the original mark and let its rounded shape inform the controls. A solid file tray replaces the dashed outline. Mint is reserved for the file symbol and the primary action. The sharing page puts the preview in the same tray.',
  },
  {
    id: 'open',
    name: 'Open',
    tag: 'Heavy type / fewer containers',
    note: 'The original wordmark sets the typographic weight. The file area is open, with one low divider rather than a card. Strong filenames, plain settings and a large uninterrupted preview make the interface feel like one small purpose-built tool.',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    tag: 'Compact rows / quiet structure',
    note: 'A narrow file slot and clearly separated rows. Mint marks the active action; the rest stays dark and calm. Monospace is used only for file sizes and links. This is the most compact direction and translates directly to the admin list.',
  },
];
const concepts = original ? originalConcepts : indieConcepts;
const mark = `<svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M4 24V11a8 8 0 0 1 16 0v13l-4-3-4 3-4-3-4 3Z" stroke="currentColor" stroke-width="1.7"/><path d="M9 10v3m6-3v3" stroke="currentColor" stroke-width="1.7"/></svg>`;
const fileIcon = `<svg viewBox="0 0 48 58" fill="none" aria-hidden="true"><path d="M8 3h22l11 11v40H8V3Z" stroke="currentColor" stroke-width="1.2"/><path d="M30 3v12h11M17 32h15m-7-7 7 7-7 7" stroke="currentColor" stroke-width="1.2"/></svg>`;
const originalFileIcon = `<svg viewBox="0 0 48 58" fill="none" aria-hidden="true"><path d="M10 4h20l11 11v35a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="currentColor"/><path d="M30 4v11h11" stroke="var(--well)" stroke-width="2" stroke-linejoin="round"/><path d="M24 42V27m-7 7 7-7 7 7" stroke="var(--well)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const photograph = `<svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Example architectural study of a concrete wall"><path fill="#b7b3a6" d="M0 0h600v420H0z"/><path fill="#ded9c9" d="M0 0h345v420H0z"/><path fill="#303d3b" d="M345 0h255v420H345z"/><path fill="#50605a" d="m345 0 255 140V0z"/><path fill="#a39f8d" d="m0 420 345-140v140z"/><path fill="#ddd6be" d="m0 140 345-75v25L0 165z"/><path stroke="#c8c3b2" d="M115 0v373M230 0v326M0 280h345"/><path stroke="#858d80" d="M425 0v420M505 0v420"/><path fill="#808779" d="M356 300h60v120h-60z"/></svg>`;
const params = new URLSearchParams(location.search);
let concept = concepts.find((c) => c.id === params.get('concept')) || concepts[0];
let state = ['landing', 'selected', 'share', 'admin'].includes(params.get('state'))
  ? params.get('state')
  : 'landing';
document.body.classList.toggle('focused', params.get('focus') === '1');
const canvas = document.querySelector('#canvas');
function drop() {
  if (original)
    return `<button class="file-well" data-action="select"><span class="file-symbol">${originalFileIcon}</span><strong>Drop a file.</strong><span>Or <u>choose one</u> to share.</span></button><div class="well-foot"><span>Nothing uploads until you're ready.</span><span>Up to 100 MB</span></div>`;
  return `<button class="file-well" data-action="select"><span class="file-symbol">${fileIcon}</span><strong>Drop a file here</strong><span>or <u>choose one</u></span></button><div class="well-foot"><span>One file at a time</span><span>100 MB maximum</span></div>`;
}
function selected() {
  return `<div class="file-row"><div class="file-thumb">${photograph}</div><div><strong>concrete-study.png</strong><span>2.4 MB / image</span></div><button class="plain" data-action="home" aria-label="Remove example file">×</button></div><div class="file-options"><label>Keep for<select><option>24 hours</option><option>7 days</option><option>30 days</option></select></label><label>Password<input type="password" placeholder="Optional" /></label><label class="check"><input type="checkbox" /> Delete after one download</label></div><div class="send-row"><span>Not uploaded yet</span><button class="solid" data-action="send">Upload file ↑</button></div>`;
}
function transfer() {
  return `<div class="transfer"><div class="section-label"><span>${state === 'selected' ? '01 / File selected' : '01 / Upload'}</span><span class="tiny-mark">${mark}</span></div>${state === 'selected' ? selected() : drop()}</div>`;
}
function share() {
  return `<div class="share-view"><div class="section-label"><span>02 / File</span><span>Available for 24 hours</span></div><div class="actual-preview">${photograph}</div><div class="download-row"><div><h2>concrete-study.png</h2><p>2.4 MB · PNG image</p></div><button class="solid" data-action="download">Download ↓</button></div><div class="share-address"><label>Share link</label><div><code>ghostdrop.local/f/4j7k2</code><button class="plain" data-action="copy">Copy</button></div></div><div class="file-lifetime"><span>Expires 03 Oct 2026, 18:30</span><details><summary>File controls</summary><div><button class="plain" data-action="copy">Direct download link</button><button class="plain" data-action="delete">Delete file</button></div></details></div></div>`;
}
function admin() {
  return `<div class="admin-view"><div class="section-label"><span>Administration / Files</span><span>128 files · 3.8 GB</span></div><div class="admin-tools"><label><span class="sr-label">Find a file</span><input id="find" type="search" placeholder="Find a file…" /></label><button class="plain" data-action="clean">Clean expired</button></div><div class="file-table"><table><thead><tr><th>Name</th><th>Size</th><th>Expires</th><th>Access</th><th></th></tr></thead><tbody>${[
    ['concrete-study.png', '2.4 MB', '03 Oct', 'Public'],
    ['archive-06.zip', '84 MB', '08 Oct', 'Password'],
    ['draft.pdf', '640 KB', 'Today', 'One use'],
    ['notes.txt', '12 KB', '03 Oct', 'Public'],
  ]
    .map(
      (f) =>
        `<tr><td>${f[0]}</td><td>${f[1]}</td><td>${f[2]}</td><td>${f[3]}</td><td><button class="plain" data-action="remove-row" aria-label="Delete example ${f[0]}">×</button></td></tr>`,
    )
    .join(
      '',
    )}</tbody></table></div><div class="table-foot"><span>4 of 128 files</span><button class="plain" data-action="next">Next page →</button></div></div>`;
}
function render() {
  document.querySelector('#concepts').innerHTML = concepts
    .map(
      (c, i) =>
        `<button data-concept="${c.id}" aria-pressed="${c.id === concept.id}"><span class="concept-number">0${i + 1}</span><span class="concept-name">${c.name}<small>${c.tag}</small></span><span class="swatch swatch-${c.id}"></span></button>`,
    )
    .join('');
  document.querySelector('#rationale').textContent = concept.note;
  document.querySelector('#concept-label').textContent =
    `0${concepts.indexOf(concept) + 1} / ${concept.name}`;
  document
    .querySelectorAll('[data-state]')
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.state === state));
  document.querySelector('#isolated').href =
    `?concept=${concept.id}&state=${state}&focus=${document.body.classList.contains('focused') ? '0' : '1'}`;
  canvas.className = `indie ${original ? 'original' : ''} ${concept.id} state-${state}`;
  canvas.innerHTML = `<div class="indie-page"><header class="identity"><a href="#" data-action="home"><span class="identity-mark">${mark}</span><span class="wordmark">ghostdrop</span><span class="wordmark-end">/</span></a><span class="identity-caption">Temporary file sharing</span><span class="registration">GD / 01</span></header><div class="workspace"><aside class="margin-note"><span class="note-number">${state === 'share' ? '02' : state === 'admin' ? '03' : '01'}</span><p>${state === 'share' ? 'Your file.\nA short stay.' : state === 'admin' ? 'A record of\nwhat remains.' : 'A place to leave\nsomething briefly.'}</p><span class="margin-tick">+</span></aside><section class="tool">${state === 'share' ? share() : state === 'admin' ? admin() : transfer()}</section></div><footer class="utility-footer"><span>Upload a file, share its link. Files expire automatically.</span><a href="#" data-action="about">About ghostdrop</a></footer><div class="mock-status" role="status" aria-live="polite"></div></div>`;
  if (original) {
    canvas.querySelector('.identity').innerHTML =
      `<a href="#" data-action="home" class="original-brand"><img src="/ghost.svg" width="44" height="48" alt="" /><span>ghostdrop<span class="original-dot">.</span></span></a>`;
    canvas.querySelector('.utility-footer').innerHTML =
      '<span>Drop a file. Share a link. Let it disappear.</span>';
    const sectionLabel = canvas.querySelector('.section-label > span');
    sectionLabel.textContent = {
      landing: 'Choose a file',
      selected: 'Ready when you are',
      share: 'Shared file',
      admin: 'Files',
    }[state];
  }
  const url = new URL(location.href);
  url.searchParams.set('concept', concept.id);
  url.searchParams.set('state', state);
  history.replaceState(null, '', url);
}
document.querySelector('#concepts').addEventListener('click', (e) => {
  const b = e.target.closest('[data-concept]');
  if (b) {
    concept = concepts.find((c) => c.id === b.dataset.concept);
    render();
  }
});
document.querySelector('#states').addEventListener('click', (e) => {
  const b = e.target.closest('[data-state]');
  if (b) {
    state = b.dataset.state;
    render();
  }
});
canvas.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  e.preventDefault();
  const a = b.dataset.action;
  if (['home', 'select', 'send'].includes(a)) {
    state = { home: 'landing', select: 'selected', send: 'share' }[a];
    render();
    return;
  }
  if (a === 'remove-row') {
    b.closest('tr').remove();
  }
  if (a === 'delete') {
    state = 'landing';
    render();
  }
  canvas.querySelector('.mock-status').textContent =
    {
      copy: 'Example link. Copy action preview.',
      download: 'Example file. Download action preview.',
      clean: 'Cleanup preview. No live files affected.',
      delete: 'Example file removed.',
      about: 'Ghostdrop is a small tool for temporary file sharing.',
      next: 'Pagination preview. These four files are examples.',
      'remove-row': 'Example row removed.',
    }[a] || '';
});
canvas.addEventListener('input', (e) => {
  if (e.target.id === 'find') {
    canvas
      .querySelectorAll('tbody tr')
      .forEach(
        (r) => (r.hidden = !r.textContent.toLowerCase().includes(e.target.value.toLowerCase())),
      );
  }
});
render();
