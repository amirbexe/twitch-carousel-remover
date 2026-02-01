# Twitch Carousel Remover

Two Chrome extensions for customizing the Twitch homepage.

## Extensions

### v1 — Twitch Carousel Remover (Simple)

A minimal extension that hides the featured carousel on the Twitch homepage. No settings, no permissions — just removes the carousel.

**Chrome Web Store:** [Twitch Carousel Remover](#) *(link coming soon)*

### v2 — Twitch Customizer (Full)

A full-featured extension that lets you customize the Twitch homepage:

- **Toggle sections** — Hide or show any homepage section (carousel, recommended channels, categories, etc.)
- **Drag-and-drop reorder** — Rearrange the order of homepage sections
- **Persistent settings** — Your preferences are saved across sessions
- **Dark themed UI** — Matches the Twitch aesthetic

**Chrome Web Store:** [Twitch Customizer](#) *(link coming soon)*

## Install from Source

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select either the `v1-simple/` or `v2-customizer/` folder
6. Navigate to [twitch.tv](https://www.twitch.tv) — changes apply immediately

## How It Works

**v1** injects a single CSS rule at page load that hides the `.front-page-carousel` element.

**v2** uses a content script with a MutationObserver to detect Twitch homepage sections, applies your saved visibility and ordering preferences, and provides a popup UI for configuration. It handles Twitch's SPA navigation so settings persist as you browse.

## License

MIT
