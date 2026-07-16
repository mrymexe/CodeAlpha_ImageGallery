# Moments & Places — Photo Gallery

A single-page, no-build photo gallery with a Pinterest-style masonry layout, category filters, live search, dark/light themes, and a lightbox with a zoom-from-thumbnail (FLIP) animation. Built with plain HTML, CSS, and JavaScript — no framework, no build tools, no backend.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Using the Gallery](#using-the-gallery)
  - [Browsing](#browsing)
  - [Adding Photos](#adding-photos)
  - [Categories](#categories)
  - [Deleting Photos](#deleting-photos)
- [How Persistence Works](#how-persistence-works)
- [Technical Overview](#technical-overview)
- [Customization](#customization)
- [Browser Support](#browser-support)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)

---

## Features

- **Masonry grid layout** — photos of any aspect ratio pack into balanced columns, computed on the fly and re-flowed on window resize.
- **Lightbox viewer** — click any photo to open a full-size view with a smooth "zoom from thumbnail" (FLIP) animation, keyboard navigation (arrow keys, Esc), swipe gestures on touch devices, and double-tap/double-click to toggle fullscreen.
- **Category filters** — built-in Nature / Urban / Interior tabs, plus the ability to create and remove your own custom categories.
- **Live search** — filters by caption or category as you type, debounced for smooth typing.
- **Add photos two ways** — upload a file from your device, or paste a direct image URL.
- **Dark / light theme toggle** — remembered across visits.
- **Persistent storage** — everything you add (and delete) is saved in the browser and still there next time you open the page. See [How Persistence Works](#how-persistence-works).
- **Accessible by design** — keyboard-navigable modal with focus trapping, `aria-live` regions for search results, labeled controls throughout.
- **Respects reduced-motion preferences** — animations are disabled if the user's OS requests reduced motion.

## Project Structure

```
gallery/
├── index.html    # Page markup: header, nav/filters, gallery grid, lightbox, add-photo modal
├── style.css     # All styling, including CSS custom properties for the two themes
├── script.js     # Gallery logic: rendering, filtering, search, lightbox, storage
└── README.md     # This file
```

There is no `assets/images/` folder required — the gallery starts empty and is populated entirely by what you add through the UI.

## Getting Started

No installation or build step is needed.

**Option 1 — Just open it**
Double-click `index.html` to open it directly in your browser.

**Option 2 — Serve it locally** (recommended, avoids some browser file:// restrictions)
```bash
npx serve .
# or
python -m http.server 8000
```
Then visit the printed local address (e.g. `http://localhost:8000`).

**Option 3 — Deploy it**
Push the folder to GitHub and enable GitHub Pages, or drag the folder into Netlify/Vercel. All three files are static, so any static host works.

## Using the Gallery

### Browsing

- Use the category tabs at the top to filter by **All**, **Nature**, **Urban**, **Interior**, or any custom category you've created.
- Type in the search box to filter by caption or category text.
- Click any photo to open it in the lightbox. Use the ◀ ▶ buttons, arrow keys, or swipe to move between photos; press **Esc** or click outside the image to close.
- Double-click (or double-tap) an open photo to toggle fullscreen.

### Adding Photos

Click **+ Add Photo**, then choose a source:

| Source | What happens |
|---|---|
| **Image File** | Pick a photo from your device. It's read into the browser and stored as a base64 data URL. |
| **Image URL** | Paste a *direct* link to an image file — one that ends in `.jpg`, `.jpeg`, `.png`, `.webp`, or `.gif`. |

**A note on pasting URLs from Pinterest, Google Images, etc.:** the link you get from a site's address bar or "share" button is usually a link to the *webpage*, not the image file itself, and won't load. Instead, right-click directly on the picture and choose **"Copy Image Address"** (or similar), then paste that. The app tries to actually load whatever URL you paste before adding it — if it fails, you'll see a clear error instead of a broken thumbnail.

The caption field auto-fills from the filename (you can edit it), and you'll pick or create a category before saving.

### Categories

- Choose an existing category from the dropdown, or select **+ Add new category** and type a name.
- Custom category tabs show a small **✕** to remove them. Removing a category doesn't delete its photos — they're moved to "uncategorized" (view them via search, or by clearing the category filter).

### Deleting Photos

Hover a photo and click the trash icon in the corner. You'll be asked to confirm — deletion is permanent and persists across reloads.

## How Persistence Works

Everything is stored in the browser's `localStorage`, so there's no backend or database involved:

- **Uploaded files** are saved as base64 data URLs. Browsers typically cap total `localStorage` at around 5–10MB. If your uploads start approaching that limit, the app automatically compresses new images (resizing to a max dimension and re-encoding as JPEG) before saving, so you don't silently lose data. If storage is completely full even after compression, you'll get a one-time alert explaining that the most recent item couldn't be saved permanently.
- **URL-based photos** only store the URL string, which takes up negligible space — if you're adding a lot of photos, prefer pasting URLs over uploading files.
- **Deletions** are recorded permanently, so a deleted photo won't come back.
- **Theme preference** (dark/light) is also remembered.

Because this all lives in `localStorage`, it's tied to one browser on one device — it won't sync between your phone and laptop, or between different browsers, and clearing your browser's site data will erase it.

## Technical Overview

- **Masonry layout**: `computeMasonryLayout()` measures each photo's aspect ratio and places it in the shortest current column, recalculating on window resize (debounced).
- **Lightbox FLIP animation**: when a photo is clicked, `runFlipAnimation()` captures the thumbnail's on-screen position, positions the full-size image to visually match it, then animates it to its final size/position using CSS transforms — giving a smooth "zoom out from the thumbnail" effect rather than a plain fade.
- **URL validation**: `validateImage()` attempts to actually load a pasted URL (with a timeout) before it's added, so bad links surface a clear error rather than an empty gallery card.
- **Storage safety**: all `localStorage` reads/writes are wrapped in try/catch; write failures trigger an automatic image-compression retry rather than silently failing.

## Customization

- **Theme colors**: edit the CSS custom properties at the top of `style.css` (`:root` for dark mode, `[data-theme="light"]` for light mode).
- **Default categories**: edit the `builtInCategories` array and the category `<select>`/filter tabs in `index.html` and `script.js`.
- **Masonry column width**: adjust `minColWidth` and `gap` inside `computeMasonryLayout()` in `script.js`.
- **Compression settings**: adjust `maxDim` / `quality` in the `compressDataUrl()` function if you want to trade off file size vs. image quality differently.

## Browser Support

Works in all modern evergreen browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled and `localStorage` available (private/incognito modes with storage disabled will lose data on tab close).

## Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| Pasted URL shows an error immediately | It's probably a webpage link, not a direct image link. Right-click the image itself and copy its address. |
| Photos disappear after closing the browser | Private/incognito browsing often restricts or clears `localStorage` — use a normal browsing window. |
| "Storage is full" alert appears | You've hit the browser's `localStorage` limit. Delete a few older uploaded photos, or add new ones via URL instead of file upload. |
| Deployed images show broken on GitHub Pages but work locally | GitHub Pages is case-sensitive; double-check filenames/paths match exactly, including capitalization. |

## Known Limitations

- Data is local to one browser/device — there's no sync or account system.
- Image URLs depend on the source site allowing hotlinking; some sites block this no matter how the link is formatted.
- Very large photo collections uploaded as files may eventually hit the browser's storage limit even with compression — URLs are the more scalable option for large collections.