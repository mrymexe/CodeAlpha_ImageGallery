// ===== YOUR OWN LOCAL IMAGES =====
// (Starter images removed — the gallery now begins empty of defaults and
// only shows what you add yourself.)
const assetImages = [];

function filenameToCaption(filename) {
  const nameOnly = filename.replace(/\.[^/.]+$/, '');
  return nameOnly
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ===== ASPECT RATIO HELPERS =====
function parsePicsumDimensions(url) {
  const match = url.match(/picsum\.photos\/id\/\d+\/(\d+)\/(\d+)/);
  return match ? parseInt(match[1], 10) / parseInt(match[2], 10) : null;
}

// Lenient measurement: used for existing/trusted images where we just want
// *some* reasonable aspect ratio, never a hard failure.
function measureImageAspectRatio(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => resolve(4 / 3);
    img.src = src;
  });
}

// Strict validation: used when the user adds a new image. Rejects on failure
// so we can tell them clearly instead of adding a broken "ghost" card.
function validateImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    const timeout = setTimeout(() => reject(new Error('timeout')), 12000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('image-failed'));
    };
    img.src = src;
  });
}

const placeholderPhotos = [];

const localAssetPhotos = assetImages.map(item => ({
  src: `assets/images/${item.file}`,
  caption: filenameToCaption(item.file),
  category: item.category,
  aspectRatio: null,
  isUserAdded: false,
}));

const defaultPhotos = [
  ...placeholderPhotos.map(p => ({
    src: p.src,
    caption: filenameToCaption(p.file),
    category: p.category,
    aspectRatio: parsePicsumDimensions(p.src) || 1.33,
    isUserAdded: false,
  })),
  ...localAssetPhotos,
];

// ===== STORAGE: user-added photos + deleted starter photos, tracked separately =====
// Every write is wrapped so a full storage quota never silently eats your data.
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Storage write failed for "${key}":`, err && err.name);
    return false;
  }
}

function loadSavedPhotos() {
  try {
    const saved = localStorage.getItem('galleryUserPhotos');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Shrinks a base64 image so it fits in localStorage.
function compressDataUrl(dataUrl, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

let storageWarningShown = false;

async function savePhotos() {
  const userAdded = photos.filter(p => p.isUserAdded);
  const json = JSON.stringify(userAdded);

  if (safeLocalStorageSet('galleryUserPhotos', json)) return true;

  // Likely quota exceeded because of large base64 images — compress and retry.
  const compressed = await Promise.all(userAdded.map(async (p) => {
    if (typeof p.src === 'string' && p.src.startsWith('data:image')) {
      return { ...p, src: await compressDataUrl(p.src) };
    }
    return p;
  }));

  if (safeLocalStorageSet('galleryUserPhotos', JSON.stringify(compressed))) {
    // Reflect the compressed versions in memory so what you see matches what's saved.
    compressed.forEach(cp => {
      const target = photos.find(p => p.id === cp.id);
      if (target) target.src = cp.src;
    });
    renderGallery();
    return true;
  }

  if (!storageWarningShown) {
    storageWarningShown = true;
    alert(
      "Your browser's storage is full, so the most recent photo couldn't be saved permanently. " +
      "It will disappear if you close this tab. Try removing a few older uploaded items, or add media by " +
      "pasting a URL instead of uploading the file directly (URLs take up far less storage space)."
    );
  }
  return false;
}

function loadDeletedSrcs() {
  try {
    return new Set(JSON.parse(localStorage.getItem('galleryDeletedStarterPhotos') || '[]'));
  } catch {
    return new Set();
  }
}

function saveDeletedSrcs() {
  safeLocalStorageSet('galleryDeletedStarterPhotos', JSON.stringify([...deletedStarterSrcs]));
}

function dedupePhotos(list) {
  const seen = new Set();
  return list.filter(p => {
    if (seen.has(p.src)) return false;
    seen.add(p.src);
    return true;
  });
}

let deletedStarterSrcs = loadDeletedSrcs();

function generatePhotoId() {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let photos = dedupePhotos([
  ...defaultPhotos,
  ...loadSavedPhotos().map(p => ({ isUserAdded: true, ...p })),
])
  .filter(p => !deletedStarterSrcs.has(p.src))
  .map(p => (p.id ? p : { ...p, id: generatePhotoId() }));

let visiblePhotos = [...photos];

// Persist the cleaned-up result so old duplicates don't reappear later.
savePhotos();

// ===== DOM REFERENCES =====
const galleryEl = document.getElementById('gallery');
const noResults = document.getElementById('no-results');
const filterTabsEl = document.getElementById('filter-tabs');
const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxCounter = document.getElementById('lightbox-counter');
const closeBtn = document.getElementById('lightbox-close');
const prevBtn = document.getElementById('lightbox-prev');
const nextBtn = document.getElementById('lightbox-next');

const modalOverlay = document.getElementById('modal-overlay');
const addPhotoTrigger = document.getElementById('add-photo-trigger');
const modalCancel = document.getElementById('modal-cancel');
const addPhotoForm = document.getElementById('add-photo-form');
const formError = document.getElementById('form-error');

const photoFileInput = document.getElementById('photo-file');
const photoUrlInput = document.getElementById('photo-url');
const sourceFileBtn = document.getElementById('source-file-btn');
const sourceUrlBtn = document.getElementById('source-url-btn');
const photoCaptionInput = document.getElementById('photo-caption');
const photoCategorySelect = document.getElementById('photo-category');
const newCategoryInput = document.getElementById('new-category-input');
const urlHint = document.getElementById('url-hint');
const submitBtn = addPhotoForm.querySelector('.btn-primary');

let currentIndex = 0;
let activeCategory = 'all';
let lightboxTrigger = null;
const builtInCategories = ['all', 'nature', 'urban', 'interior'];

// ===== THEME TOGGLE =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
  safeLocalStorageSet('galleryTheme', theme);
}

applyTheme(localStorage.getItem('galleryTheme') || 'dark');

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'light' ? 'dark' : 'light');
});

// ===== DEBOUNCE =====
function debounce(fn, delay = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ===== MASONRY LAYOUT ENGINE =====
function computeMasonryLayout(aspectRatios, containerWidth) {
  const gap = 22;
  const minColWidth = 240;
  const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (minColWidth + gap)));
  const colWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
  const colHeights = new Array(columnCount).fill(0);

  const positions = aspectRatios.map((ratio) => {
    const itemHeight = colWidth / (ratio || 1.33);
    let shortestCol = 0;
    for (let c = 1; c < columnCount; c++) {
      if (colHeights[c] < colHeights[shortestCol]) shortestCol = c;
    }
    const left = shortestCol * (colWidth + gap);
    const top = colHeights[shortestCol];
    colHeights[shortestCol] = top + itemHeight + gap;
    return { left, top, width: colWidth, height: itemHeight };
  });

  return { positions, totalHeight: Math.max(...colHeights, 0) };
}

// ===== DELETE PHOTO =====
function deletePhoto(photo) {
  const confirmed = confirm(`Remove "${photo.caption}" from the gallery? This can't be undone.`);
  if (!confirmed) return;

  if (!photo.isUserAdded) {
    deletedStarterSrcs.add(photo.src);
    saveDeletedSrcs();
  }

  photos = photos.filter(p => p.id !== photo.id);
  visiblePhotos = visiblePhotos.filter(p => p.id !== photo.id);
  savePhotos();

  // Remove just this one card and let the rest reflow into place,
  // instead of rebuilding (and briefly blanking) the whole gallery.
  const figure = galleryEl.querySelector(`[data-photo-id="${photo.id}"]`);
  if (figure) figure.remove();
  relayoutGallery();

  noResults.textContent = photos.length === 0
    ? 'No photos yet — click "+ Add Photo" to get started.'
    : 'No photos match your search.';
  noResults.classList.toggle('show', visiblePhotos.length === 0);
}

// ===== RENDER GALLERY =====
function renderGallery() {
  const term = searchInput.value.trim().toLowerCase();

  visiblePhotos = photos.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = p.caption.toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  galleryEl.innerHTML = '';

  const containerWidth = galleryEl.clientWidth || galleryEl.parentElement.clientWidth;
  const { positions, totalHeight } = computeMasonryLayout(
    visiblePhotos.map(p => p.aspectRatio || 1.33),
    containerWidth
  );

  visiblePhotos.forEach((photo, index) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';
    figure.style.animationDelay = `${Math.min(index * 0.04, 0.4)}s`;
    figure.style.width = `${positions[index].width}px`;
    figure.style.height = `${positions[index].height}px`;
    figure.style.left = `${positions[index].left}px`;
    figure.style.top = `${positions[index].top}px`;
    figure.dataset.aspect = photo.aspectRatio || 1.33;
    figure.dataset.photoId = photo.id;

    const mediaEl = document.createElement('img');
    mediaEl.src = photo.src;
    mediaEl.alt = photo.caption;
    mediaEl.loading = 'lazy';
    mediaEl.decoding = 'async';
    mediaEl.referrerPolicy = 'no-referrer';
    mediaEl.addEventListener('load', () => mediaEl.classList.add('loaded'));
    mediaEl.addEventListener('error', () => figure.classList.add('media-error'));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-photo-btn';
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
    deleteBtn.setAttribute('aria-label', `Delete ${photo.caption}`);
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deletePhoto(photo);
    });

    figure.appendChild(mediaEl);
    figure.appendChild(deleteBtn);

    figure.addEventListener('click', () => {
      lightboxTrigger = figure;
      openLightbox(index, figure.getBoundingClientRect());
    });

    galleryEl.appendChild(figure);
  });

  galleryEl.style.height = `${totalHeight}px`;

  noResults.textContent = photos.length === 0
    ? 'No photos yet — click "+ Add Photo" to get started.'
    : 'No photos match your search.';
  noResults.classList.toggle('show', visiblePhotos.length === 0);
}

// ===== REPOSITION ONLY (window resize) =====
function relayoutGallery() {
  const items = [...galleryEl.children];
  if (items.length === 0) return;

  const containerWidth = galleryEl.clientWidth || galleryEl.parentElement.clientWidth;
  const aspects = items.map(item => parseFloat(item.dataset.aspect) || 1.33);
  const { positions, totalHeight } = computeMasonryLayout(aspects, containerWidth);

  items.forEach((item, index) => {
    item.style.width = `${positions[index].width}px`;
    item.style.height = `${positions[index].height}px`;
    item.style.left = `${positions[index].left}px`;
    item.style.top = `${positions[index].top}px`;
  });

  galleryEl.style.height = `${totalHeight}px`;
}

window.addEventListener('resize', debounce(relayoutGallery, 150));

// ===== FILL MISSING ASPECT RATIOS THEN RE-RENDER ONCE =====
async function fillMissingAspectRatios() {
  const needsMeasuring = photos.filter(p => !p.aspectRatio);
  if (needsMeasuring.length === 0) return;

  await Promise.all(needsMeasuring.map(async (p) => {
    p.aspectRatio = await measureImageAspectRatio(p.src);
  }));

  savePhotos();
  renderGallery();
}

// ===== LIGHTBOX (with FLIP zoom-from-thumbnail animation for images) =====
function openLightbox(index, sourceRect = null) {
  currentIndex = index;
  const photo = visiblePhotos[currentIndex];
  lightboxCaption.textContent = photo.caption;
  lightboxCounter.textContent = `${currentIndex + 1} / ${visiblePhotos.length}`;
  lightbox.classList.add('active');

  lightboxImg.style.transition = 'none';
  lightboxImg.style.transform = 'none';
  lightboxImg.style.opacity = sourceRect ? '1' : '0';
  lightboxImg.src = photo.src;

  if (sourceRect) {
    runFlipAnimation(sourceRect);
  } else {
    requestAnimationFrame(() => {
      lightboxImg.style.transition = 'opacity 0.25s ease';
      lightboxImg.style.opacity = '1';
    });
  }

  closeBtn.focus();
}

function runFlipAnimation(sourceRect) {
  const apply = () => {
    const finalRect = lightboxImg.getBoundingClientRect();
    if (!finalRect.width || !finalRect.height) return;

    const deltaX = (sourceRect.left + sourceRect.width / 2) - (finalRect.left + finalRect.width / 2);
    const deltaY = (sourceRect.top + sourceRect.height / 2) - (finalRect.top + finalRect.height / 2);
    const scaleX = sourceRect.width / finalRect.width;
    const scaleY = sourceRect.height / finalRect.height;

    lightboxImg.style.transition = 'none';
    lightboxImg.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;

    requestAnimationFrame(() => {
      lightboxImg.style.transition = 'transform 0.42s cubic-bezier(0.22, 0.9, 0.28, 1)';
      lightboxImg.style.transform = 'translate(0, 0) scale(1)';
    });
  };

  if (lightboxImg.decode) {
    lightboxImg.decode().then(apply).catch(apply);
  } else {
    requestAnimationFrame(apply);
  }
}

function closeLightbox() {
  lightbox.classList.remove('active');
  if (document.fullscreenElement) document.exitFullscreen();
  if (lightboxTrigger) lightboxTrigger.focus();
}

function showNext() {
  currentIndex = (currentIndex + 1) % visiblePhotos.length;
  openLightbox(currentIndex);
}

function showPrev() {
  currentIndex = (currentIndex - 1 + visiblePhotos.length) % visiblePhotos.length;
  openLightbox(currentIndex);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    lightbox.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

closeBtn.addEventListener('click', closeLightbox);
nextBtn.addEventListener('click', showNext);
prevBtn.addEventListener('click', showPrev);

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

lightboxImg.addEventListener('dblclick', toggleFullscreen);

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let lastTapTime = 0;

lightboxImg.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
}, { passive: true });

lightboxImg.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const dt = Date.now() - touchStartTime;
  const distance = Math.hypot(dx, dy);

  if (distance < 12 && dt < 300) {
    const now = Date.now();
    if (now - lastTapTime < 300) toggleFullscreen();
    lastTapTime = now;
    return;
  }

  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    if (dx < 0) showNext(); else showPrev();
  }
}, { passive: true });

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') showNext();
  if (e.key === 'ArrowLeft') showPrev();
});

// ===== FILTER TABS + SEARCH =====
filterTabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  filterTabsEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.filter;
  renderGallery();
});

searchInput.addEventListener('input', debounce(renderGallery, 200));

// ===== ADD PHOTO MODAL =====
function trapFocusInModal(e) {
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab') return;

  const focusable = modalOverlay.querySelectorAll('button, input, select');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function openModal() {
  modalOverlay.classList.add('active');
  sourceFileBtn.focus();
  document.addEventListener('keydown', trapFocusInModal);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  addPhotoForm.reset();
  photoFileInput.style.display = 'block';
  photoUrlInput.style.display = 'none';
  sourceFileBtn.classList.add('active');
  sourceUrlBtn.classList.remove('active');
  urlHint.style.display = 'none';
  newCategoryInput.style.display = 'none';
  formError.textContent = '';
  setSubmitting(false);
  document.removeEventListener('keydown', trapFocusInModal);
  addPhotoTrigger.focus();
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.textContent = isSubmitting ? 'Adding…' : 'Add Photo';
}

addPhotoTrigger.addEventListener('click', openModal);
modalCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

sourceFileBtn.addEventListener('click', () => {
  sourceFileBtn.classList.add('active');
  sourceUrlBtn.classList.remove('active');
  photoFileInput.style.display = 'block';
  photoUrlInput.style.display = 'none';
  urlHint.style.display = 'none';
});

sourceUrlBtn.addEventListener('click', () => {
  sourceUrlBtn.classList.add('active');
  sourceFileBtn.classList.remove('active');
  photoUrlInput.style.display = 'block';
  photoFileInput.style.display = 'none';
  urlHint.style.display = 'block';
});

photoFileInput.addEventListener('change', () => {
  const file = photoFileInput.files[0];
  if (file) photoCaptionInput.value = filenameToCaption(file.name);
});

photoUrlInput.addEventListener('input', () => {
  const url = photoUrlInput.value.trim();
  const match = url.match(/\/([^\/?#]+)\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
  if (match) photoCaptionInput.value = filenameToCaption(`${match[1]}.${match[2]}`);
});

photoCategorySelect.addEventListener('change', () => {
  newCategoryInput.style.display = photoCategorySelect.value === '__new__' ? 'block' : 'none';
});

function ensureFilterTabExists(category) {
  const exists = [...filterTabsEl.querySelectorAll('.filter-btn')].some(btn => btn.dataset.filter === category);
  if (exists) return;

  const btn = document.createElement('button');
  btn.className = 'filter-btn';
  btn.dataset.filter = category;

  const label = category.charAt(0).toUpperCase() + category.slice(1);
  btn.append(label + ' ');

  if (!builtInCategories.includes(category)) {
    const removeX = document.createElement('span');
    removeX.textContent = '✕';
    removeX.className = 'remove-category';
    removeX.setAttribute('aria-label', `Remove ${label} category`);
    removeX.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCategory(category);
    });
    btn.appendChild(removeX);
  }

  filterTabsEl.appendChild(btn);

  const option = document.createElement('option');
  option.value = category;
  option.textContent = label;
  photoCategorySelect.insertBefore(option, photoCategorySelect.lastElementChild);
}

function removeCategory(category) {
  const confirmed = confirm(`Remove the "${category}" category? Photos in it will move to "All" but won't be deleted.`);
  if (!confirmed) return;

  filterTabsEl.querySelector(`.filter-btn[data-filter="${category}"]`)?.remove();
  photoCategorySelect.querySelector(`option[value="${category}"]`)?.remove();

  photos.forEach(p => {
    if (p.category === category) p.category = 'uncategorized';
  });
  savePhotos();

  if (activeCategory === category) {
    activeCategory = 'all';
    filterTabsEl.querySelector('[data-filter="all"]').classList.add('active');
  }

  renderGallery();
}

function rebuildCustomCategoryTabs() {
  const customCategories = [...new Set(
    photos.map(p => p.category).filter(cat => !builtInCategories.includes(cat))
  )];
  customCategories.forEach(cat => ensureFilterTabExists(cat));
}

// ===== FORM SUBMIT =====
addPhotoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const caption = photoCaptionInput.value.trim();
  let category = photoCategorySelect.value;

  if (category === '__new__') {
    category = newCategoryInput.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!category) {
      formError.textContent = 'Please type a category name.';
      return;
    }
  }

  const usingFile = sourceFileBtn.classList.contains('active');

  async function addPhotoAndFinish(src) {
    if (photos.some(p => p.src === src)) {
      formError.textContent = 'That photo is already in the gallery.';
      setSubmitting(false);
      return;
    }

    let aspectRatio;
    try {
      aspectRatio = await validateImage(src);
    } catch (err) {
      setSubmitting(false);
      formError.textContent = "Couldn't load that image. Right-click the picture on the site (Pinterest, Google, etc.) and choose \"Copy Image Address\" to get a direct link, then paste that.";
      return;
    }

    photos.push({ src, caption, category, aspectRatio, isUserAdded: true, id: generatePhotoId() });
    ensureFilterTabExists(category);
    await savePhotos();
    renderGallery();
    setSubmitting(false);
    closeModal();
  }

  setSubmitting(true);

  if (usingFile) {
    const file = photoFileInput.files[0];
    if (!file) { formError.textContent = 'Please choose a file.'; setSubmitting(false); return; }
    const reader = new FileReader();
    reader.onload = () => addPhotoAndFinish(reader.result);
    reader.onerror = () => {
      formError.textContent = 'Could not read that file. Try another.';
      setSubmitting(false);
    };
    reader.readAsDataURL(file);
  } else {
    const url = photoUrlInput.value.trim();
    if (!url) { formError.textContent = 'Please paste an image URL.'; setSubmitting(false); return; }
    addPhotoAndFinish(url);
  }
});

// ===== INITIAL LOAD =====
rebuildCustomCategoryTabs();
renderGallery();
fillMissingAspectRatios();
