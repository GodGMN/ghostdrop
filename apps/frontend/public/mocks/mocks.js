const directions = [
  {
    id: 'spectral',
    name: 'Spectral',
    tag: 'Soft / quiet / curious',
    color: '#b9a1ec',
    headline: 'Here for a moment.',
    sub: 'A small home for files on their way somewhere else.',
    rationale:
      'A floating ghost, warm paper and lavender. The disappearing-file idea becomes the identity. Large serif type gives it a quieter, more personal voice.',
  },
  {
    id: 'signal',
    name: 'Signal',
    tag: 'Bold / graphic / direct',
    color: '#ff5b35',
    headline: 'DROP.\nSEND.\nGONE.',
    sub: 'File sharing. Without the baggage.',
    rationale:
      'An orange action panel and oversized condensed typography. The layout reads like a graphic poster, with a sharp, practical upload tool beside it.',
  },
  {
    id: 'afterhours',
    name: 'After hours',
    tag: 'Dark / atmospheric / precise',
    color: '#7c8aff',
    headline: 'Send it into\nthe night.',
    sub: 'Temporary file sharing, with a little mystery.',
    rationale:
      'Ink blue, a luminous portal and restrained controls. This is the most atmospheric option. The glow belongs to the drop target rather than surrounding every control.',
  },
  {
    id: 'airmail',
    name: 'Airmail',
    tag: 'Warm / tactile / familiar',
    color: '#d85039',
    headline: 'A little delivery.',
    sub: 'Leave a file. Send a link. It takes care of the rest.',
    rationale:
      'The file is a parcel and the share link is its delivery slip. Postal marks, perforated edges and warm paper make the product feel useful and human.',
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    tag: 'Technical / compact / confident',
    color: '#c5f36c',
    headline: 'Transfer.\nThen disappear.',
    sub: 'A temporary home for your next handoff.',
    rationale:
      'A precise instrument for people who share files all day. Monospace details, visible file state and a lime accent translate naturally into a dense admin panel.',
  },
  {
    id: 'tide',
    name: 'Low tide',
    tag: 'Bright / fluid / open',
    color: '#387cda',
    headline: 'Let it go.',
    sub: 'Simple file sharing. Nothing to keep up with.',
    rationale:
      'An open blue canvas with an asymmetric wave and rounded controls. The drop area becomes a wide shelf, giving files more room and avoiding the centered box composition.',
  },
  {
    id: 'velvet',
    name: 'Velvet',
    tag: 'Expressive / editorial / warm',
    color: '#efb1bf',
    headline: 'Good things\npass through.',
    sub: 'For the files you need to send, not keep.',
    rationale:
      'Wine red, oversized italic type and a pink file tray. Strong typography supplies the personality without relying on a large illustrated mascot.',
  },
  {
    id: 'index',
    name: 'Index',
    tag: 'Clean / structured / timeless',
    color: '#222222',
    headline: 'Less to hold.\nMore to share.',
    sub: 'Temporary file sharing. One file, one link.',
    rationale:
      'A black-and-white grid with a small geometric ghost. Numbered steps and crisp rules make every state easy to scan. The clearest and least decorative direction.',
  },
];
const ghost = `<svg viewBox="0 0 100 110" fill="none" aria-hidden="true"><path d="M17 94V46a33 33 0 0 1 66 0v48L70 83 57 96 43 84 30 96 17 94Z" fill="currentColor"/><ellipse cx="40" cy="46" rx="4" ry="7" fill="var(--bg)"/><ellipse cx="61" cy="46" rx="4" ry="7" fill="var(--bg)"/></svg>`;
const picture = `<svg class="sample-image" viewBox="0 0 700 440" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Example illustration of a coastal sunset"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#e6c9bc"/><stop offset="1" stop-color="#f5e4ca"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h700v440H0z"/><circle cx="460" cy="132" r="49" fill="#fff6d9"/><path fill="#8da39d" d="M0 200 130 170 260 216 410 183 550 205 700 160v280H0z"/><path fill="#607e84" d="M0 260q160-70 330 5t370-20v195H0z"/><path fill="#2d545d" d="M0 335q180-62 350 0t350-22v127H0z"/><path d="M0 379q190-60 350 0t350-22" stroke="#a8c2b4" stroke-width="2" fill="none"/></svg>`;
const params = new URLSearchParams(location.search);
let concept = directions.find((d) => d.id === params.get('concept')) || directions[0];
let state = ['landing', 'selected', 'share', 'admin'].includes(params.get('state'))
  ? params.get('state')
  : 'landing';
document.body.classList.toggle('focused', params.get('focus') === '1');
const canvas = document.querySelector('#canvas');
function brand() {
  return `<a href="#" class="mock-brand" data-action="home"><span class="brand-mark">${ghost}</span>ghostdrop<span class="brand-punctuation">.</span></a>`;
}
function settings() {
  return `<div class="settings"><label>Expires in<select aria-label="Example expiration"><option>24 hours</option><option>7 days</option><option>30 days</option></select></label><label>Password<input type="password" placeholder="Optional" aria-label="Example password" /></label><label class="once"><input type="checkbox" /> One download</label></div>`;
}
function selected() {
  return `<div class="selected-file"><div class="mini-image">${picture}</div><div><strong>coast-at-dusk.png</strong><span>2.4 MB · ready to send</span></div><button class="remove" data-action="home" aria-label="Remove example file">×</button></div>${settings()}<button class="primary" data-action="send">Create a link <span>↗</span></button><p class="fine">Your file stays here until you send it.</p>`;
}
function landing() {
  return `<button class="drop-pad" data-action="select"><span class="drop-art"><span class="large-ghost">${ghost}</span><span class="drop-arrow">↓</span></span><span class="drop-caption">Drop your file here</span><span class="drop-hint">or choose a file <span>↗</span></span></button>`;
}
function share() {
  return `<section class="share-layout"><div class="preview-art">${picture}<span class="preview-label">coast-at-dusk.png</span></div><div class="share-details"><span class="kicker">Ready to share</span><h2>A brief stay.<br />A simple link.</h2><p class="file-meta">coast-at-dusk.png · 2.4 MB</p><div class="link-box"><span>ghostdrop.local/f/coast</span><button data-action="copy">Copy link</button></div><button class="primary" data-action="download">Download file <span>↓</span></button><p class="expiry"><span class="status-dot"></span> Disappears tomorrow at 18:30</p><details><summary>Manage this file</summary><div class="manage"><button data-action="copy">Copy direct download link</button><button data-action="delete">Delete example file</button></div></details></div></section>`;
}
function admin() {
  return `<section class="admin"><div class="admin-title"><div><span class="kicker">Administration</span><h2>Files in transit.</h2></div><button class="secondary" data-action="clean">Clean expired files ↗</button></div><div class="stats"><div><span>Stored files</span><strong>128</strong></div><div><span>Storage used</span><strong>3.8 <small>GB</small></strong></div><div><span>Expiring today</span><strong>24</strong></div></div><div class="table-tools"><label>Search<input id="example-search" placeholder="Search by filename…" type="search" /></label><span>Recent uploads</span></div><div class="table-wrap"><table><thead><tr><th>File</th><th>Size</th><th>Expires</th><th>Access</th><th></th></tr></thead><tbody>${[
    ['coast-at-dusk.png', '2.4 MB', 'Tomorrow', 'Public'],
    ['brand-assets.zip', '84 MB', 'In 6 days', 'Password'],
    ['handoff.pdf', '640 KB', 'In 2 hours', 'One download'],
    ['notes.md', '12 KB', 'Tomorrow', 'Public'],
  ]
    .map(
      (f, i) =>
        `<tr><td><span class="table-icon">${['IMG', 'ZIP', 'PDF', 'MD'][i]}</span>${f[0]}</td><td>${f[1]}</td><td>${f[2]}</td><td><span class="access">${f[3]}</span></td><td><button data-action="delete-row" aria-label="Delete example ${f[0]}">×</button></td></tr>`,
    )
    .join(
      '',
    )}</tbody></table></div><p class="fine" id="admin-feedback">Showing 4 of 128 files · Example data</p></section>`;
}
function render() {
  document.querySelector('#concepts').innerHTML = directions
    .map(
      (d, i) =>
        `<button data-concept="${d.id}" aria-pressed="${concept.id === d.id}"><span class="concept-number">0${i + 1}</span><span class="concept-name">${d.name}<small>${d.tag}</small></span><span class="swatch swatch-${d.id}"></span></button>`,
    )
    .join('');
  document.querySelector('#rationale').textContent = concept.rationale;
  document.querySelector('#concept-label').textContent =
    `0${directions.indexOf(concept) + 1} / ${concept.name}`;
  document
    .querySelectorAll('[data-state]')
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.state === state));
  document.querySelector('#isolated').href =
    `?concept=${concept.id}&state=${state}&focus=${document.body.classList.contains('focused') ? '0' : '1'}`;
  canvas.className = `design ${concept.id} state-${state}`;
  canvas.innerHTML = `<div class="design-body"><header class="mock-header">${brand()}<span class="header-note">Files come and go.</span><span class="edition">${concept.id === 'airmail' ? 'EXPRESS DELIVERY' : 'TEMPORARY BY DESIGN'}</span></header>${state === 'share' ? share() : state === 'admin' ? admin() : `<section class="upload-layout"><div class="hero-copy"><span class="kicker">${concept.id === 'index' ? '01 / A file in transit' : 'Share something. Keep nothing.'}</span><h2>${concept.headline.replaceAll('\n', '<br />')}</h2><p>${concept.sub}</p><div class="hero-detail"><span class="status-dot"></span> Yours to send. Yours to delete.</div></div><div class="upload-card">${concept.id === 'airmail' ? '<div class="postal-strip"></div><span class="parcel-label">DIGITAL PARCEL / NO. 001</span>' : ''}${state === 'selected' ? selected() : landing()}${concept.id === 'signal' ? '<span class="card-corner">GD / 01</span>' : ''}</div></section>`}<footer class="mock-footer"><span>Drop a file. Share a link. Let it disappear.</span><span>Ghostdrop ${concept.id === 'index' ? '© 2026' : '↘'}</span></footer><p class="toast" role="status" aria-live="polite"></p></div>`;
  const url = new URL(location.href);
  url.searchParams.set('concept', concept.id);
  url.searchParams.set('state', state);
  history.replaceState(null, '', url);
}
document.querySelector('#concepts').addEventListener('click', (e) => {
  const b = e.target.closest('[data-concept]');
  if (b) {
    concept = directions.find((d) => d.id === b.dataset.concept);
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
  const action = b.dataset.action;
  if (['home', 'select', 'send'].includes(action)) {
    state = { home: 'landing', select: 'selected', send: 'share' }[action];
    render();
    return;
  }
  if (action === 'delete-row') {
    b.closest('tr').remove();
    document.querySelector('#admin-feedback').textContent =
      'Example file removed. Live files are unchanged.';
    return;
  }
  if (action === 'delete') {
    state = 'landing';
    render();
  }
  canvas.querySelector('.toast').textContent =
    {
      copy: 'Copy-link action preview. This is an example link.',
      download: 'Download action preview. This is an example file.',
      clean: 'Expired-file cleanup preview. Live files are unchanged.',
      delete: 'Example file deleted.',
    }[action] || '';
});
canvas.addEventListener('input', (e) => {
  if (e.target.id === 'example-search') {
    const q = e.target.value.toLowerCase();
    canvas
      .querySelectorAll('tbody tr')
      .forEach((row) => (row.hidden = !row.textContent.toLowerCase().includes(q)));
  }
});
render();
