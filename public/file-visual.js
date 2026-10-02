const groups = {
  archive: ['zip', 'rar', '7z', 'gz', 'tgz', 'tar', 'bz2', 'xz'],
  document: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'log'],
  sheet: ['xls', 'xlsx', 'ods', 'csv', 'tsv'],
  slides: ['ppt', 'pptx', 'odp', 'key'],
  code: [
    'js',
    'ts',
    'jsx',
    'tsx',
    'html',
    'css',
    'json',
    'xml',
    'yaml',
    'yml',
    'py',
    'php',
    'go',
    'rs',
    'sh',
    'sql',
    'env',
  ],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'opus'],
  video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic', 'tiff', 'ico'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
};
const symbols = {
  archive: '<path d="M20 17v3m-3 0h6v5h-6zm3 5v4m-3 0h6v5h-6z"/>',
  document: '<path d="M11 23h17M11 29h17M11 35h10"/>',
  sheet: '<path d="M10 22h19v16H10zM10 27h19M10 32h19M17 22v16"/>',
  slides: '<path d="M10 22h20v13H10zm10 13v5m-5 0h10M14 29h3m3 0h6"/>',
  code: '<path d="m15 24-5 6 5 6m10-12 5 6-5 6m-4-13-3 14"/>',
  audio:
    '<path d="M18 34V23l11-3v11m-11-5 11-3"/><ellipse cx="14" cy="35" rx="4" ry="3"/><ellipse cx="25" cy="32" rx="4" ry="3"/>',
  video: '<path d="m16 22 12 8-12 8z"/>',
  image: '<path d="M10 23h20v15H10zm0 12 6-6 5 5 4-4 5 5"/><circle cx="25" cy="27" r="1.5"/>',
};
export function fileIcon(name) {
  const extension = name.includes('.') ? name.split('.').at(-1).toLowerCase() : '';
  const kind = Object.entries(groups).find(([, extensions]) => extensions.includes(extension))?.[0];
  const label = extension
    .replace(/[^a-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const symbol =
    symbols[kind] ||
    `<text x="20" y="33" text-anchor="middle" fill="currentColor" stroke="none" font-size="${label.length > 3 ? 8 : 10}" font-weight="700">${extension === 'pdf' ? 'PDF' : kind === 'font' ? 'Aa' : label}</text>`;
  return `<svg class="file-glyph" viewBox="0 0 40 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h17l9 9v29a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"/><path d="M25 3v9h9"/>${symbol}</svg>`;
}
export function localThumbnail(element, file) {
  if (
    !/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(file.type) &&
    !/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)
  )
    return () => {};
  const url = URL.createObjectURL(file);
  const image = document.createElement('img');
  image.alt = '';
  image.src = url;
  image.onerror = () => {
    element.innerHTML = fileIcon(file.name);
    element.classList.remove('has-thumbnail');
    URL.revokeObjectURL(url);
  };
  element.classList.add('has-thumbnail');
  element.replaceChildren(image);
  return () => URL.revokeObjectURL(url);
}
