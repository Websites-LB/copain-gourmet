# Copain Gourmet

Website for Copain Gourmet, Voie Romaine, Byblos. A static site: no build step.

- `site/` is the whole website (`index.html`, `styles.css`, `main.js`, `data/menu.js`, `img/`).
- `tools/` holds the two scripts that refresh the menu and its photos.
- `dev-server.mjs` is a tiny local preview server.

## Preview locally

    node dev-server.mjs

Then open http://localhost:4173.

## Update the menu

The menu comes from Copain's Dinesty feed. Run these in order:

    node tools/build-menu.mjs --fetch
    node tools/fetch-images.mjs

The first rewrites `site/data/menu.js`. The second downloads any new dish photos into `site/img/`.

## To confirm with Copain

- The booking form opens WhatsApp on +961 76 363 811. Confirm that number takes WhatsApp.
- The 20% student discount and the $11 per person Gourmet P'tit Dej come from their October 2026 Instagram posts.
- Dish names are spelled exactly as on their menu.
