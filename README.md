# Kabo

A responsive crochet storefront and password-protected local studio dashboard. Built with Node.js 24, SQLite, and plain HTML/CSS/JavaScript. No package install or external runtime dependencies are required.

## Run

```sh
node server.js
```

Open **http://localhost:3000** for the store and **http://localhost:3000/admin** for the dashboard. On first startup a random admin password is written to `.data/admin-access.txt`. Open that file locally, sign in, and change the password in Settings. Keep `.data` private and out of source control. On Windows, `npm.cmd start` also works when PowerShell script execution is restricted.

Optional environment variables: `PORT` (default 3000), `DATA_DIR` (default `.data`), and `ADMIN_PASSWORD` (used only to initialize a new database). The server deliberately binds to the loopback interface; it is a local preview, not a public deployment.

## Included

- Responsive storefront, search, category filters, sorting, product descriptions, sizes, stock-aware cart, product-card quick add, discount codes, and demo checkout. Warm ivory, deep plum, and muted rose form the updated palette.
- Customer accounts at `/account`: sign-up/sign-in, order history, order status timeline, shipping reference, profile/default delivery address, password changes, and sign-out. Checkout requires a customer session. Customer sessions persist in SQLite for seven days, and passwords use salted scrypt hashes.
- Dedicated `/shop`, `/collections/{category}`, and `/products/{id}` pages with direct-link/reload support, breadcrumbs, related products, and a sticky header. Unknown collections or unavailable product URLs return HTTP 404.
- Custom Kabo monogram and wordmark, responsive galleries with swipe/thumbnail/arrow controls, and an optional image-sequence 360-degree viewer.
- Animated “Text us” widget with WhatsApp (+1 707 978 6179, editable in Settings) and a private admin inbox. Messages support status updates and private notes. Reply links open your email application; this is not live chat and does not send email automatically.
- Admin login with scrypt password hashing, HttpOnly sessions, same-origin mutation checks, login throttling, and password changes.
- Product creation/editing/deletion/visibility, prices, descriptions, image paths or HTTPS URLs, sizes, and aggregate stock.
- Orders with customer/delivery information, private notes, and New → Making → Shipped → Completed workflow. Cancelling New or Making orders restores stock once.
- Overview, recent orders, order-count chart, stock alerts, customer histories, percentage discounts, settings, CSV exports, and JSON data export.
- SQLite persistence, server-calculated checkout totals, inventory validation, and transactional order creation.

## Scope before launch

The catalog, generated photos, and prices are illustrative. USD and a flat delivery fee of 5 are editable defaults. Checkout creates **demo orders only** and collects no payment. Use fictional personal information while evaluating it.

Public launch still requires real product photos/content/prices, chosen market and currency, payment integration and verified webhooks, tax and delivery rules, transactional email, HTTPS hosting, production admin-session/rate-limit storage, recovery/backups, and store policies. Stock is currently per product, not per size. There are no image uploads, refunds, automated shipping, discount expiry/usage limits, or automated backup restoration. Customer email verification and forgotten-password recovery are not connected yet. Customers can change their password while signed in with their current password. The admin supports local operation rather than every possible ecommerce integration.

Customer orders are linked to the authenticated account ID at checkout, not to an email supplied by the browser. Existing guest demo orders are preserved in admin but are not automatically claimed by newly registered email addresses. Customer order responses exclude private admin notes. Admin can add a shipping carrier/reference and update status; customers see those updates when they open order details. Tracking shows studio updates rather than a live carrier feed. Profile email changes and cross-device cart synchronization are not included; carts remain stored in the current browser.

To add a photograph, place it in `public/assets` and enter `/assets/filename.png` in the product editor, or enter an HTTPS image URL. Shorts and skirts use an explicitly labeled placeholder until photographs are available.

For galleries, open **Admin → Products → Edit** and enter extra photo URLs or asset paths, one per line. The main photo appears first, followed by up to 20 additional photos. For rotation, add 4–72 images in clockwise order in the **360° image sequence** field. The 360° control appears only when a sequence is configured. Existing sample products have a single photograph and no invented rotation frames. See [the product photography guide](docs/product-photography.md) for the capture and AI-assisted preparation workflow.

## Verification

```sh
node --test
```

The isolated integration suite checks access controls, origin protection, catalog CRUD/validation, server pricing, discount validation, aggregate stock, order state transitions, cancellation restocking, persistent data, and password/session invalidation. Test data uses a temporary directory and never changes the local store database.

For the browser smoke check, run `node scripts/verify-ui.mjs`. It uses the installed Windows Chrome browser, or the executable supplied in `CHROME_PATH`. It starts isolated test servers, checks the storefront/admin workflow at desktop and mobile sizes, and saves screenshots under `output/`. Chrome runs headlessly with an isolated temporary profile and its sandbox disabled for this local test only; do not use that browser process for external browsing.

## Project layout

- `server.js`: HTTP server, SQLite storage, authentication, and API.
- `customers.js`: customer registration, sessions, profiles, password changes, and ownership-checked order access.
- `public/`: storefront, dashboard, shared client code, styles, and image assets.
- `test/store.test.js`: API integration tests.
- `.data/`: local database and initial access instructions (ignored by Git).
- `docs/image-prompts.md`: generated asset provenance and prompts.
