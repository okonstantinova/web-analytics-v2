# khrum-khrum (web-analytics)

A Russian-language single-page recipe browser ("Хрум-Хрум") used as a
sandbox for evaluating web analytics (Yandex Metrika). The application
is fully client-side: 150 recipes ship as static JSON, 150 dish images
ship as static JPEGs, and there is no backend, no database, no API, and no
authentication.

This document describes what the project is, how it is built, and the
shape of its deployment. A separate document, `DEPLOY.md`, contains the
step-by-step instructions for provisioning the VM and configuring the
GitHub Actions pipeline.

---

## 1. Repository model

This repository (`web-analytics-v1`, public) holds the source code of
**app 1** of the khrum-khrum project. App 1's single long-lived branch
is `main`; every push to `main` is shippable and will be built and
deployed by the GitHub Actions pipeline described in `DEPLOY.md`.

A **separate public repository** (`web-analytics-v2`) holds app 2 with
the same shape — same `Dockerfile`, same workflow template, same shared
VM. The two apps are deployed side-by-side behind a single reverse
proxy:

| Repo                  | App   | Branch   | Public URL                       | On-VM directory          |
| --------------------- | ----- | -------- | -------------------------------- | ------------------------ |
| `web-analytics-v1`    | app 1 | `main` | `https://v1.khrum-khrum.info`    | `/data/khrum_khrum/v1`   |
| `web-analytics-v2`    | app 2 | `main` | `https://v2.khrum-khrum.info`    | `/data/khrum_khrum/v2`   |

The apex `https://khrum-khrum.info` is **not** a serving host — Caddy
returns HTTP 404 there (valid TLS, short explanatory body). The DNS A
record exists so that the cert can be issued and so that anyone landing
on the bare domain sees a clean, debuggable error instead of a cert
warning. See `DEPLOY.md` §4.2.

The two repos are intentionally independent: each evolves its own
source, Yandex Metrika counter id and UI experiments. They share:

- The same `Dockerfile` shape (Node-based static build → `serve`).
- The same image-publishing and deployment workflow shape
  (`.github/workflows/deploy.yml`, one per repo, parametrised for the
  app it owns).
- The same VM, the same reverse proxy, the same TLS issuer.

There is **no `master` branch** in either repo's deployment model. If
`master` exists in the remote (from an earlier layout), treat it as
historical / archival only.

---

## 2. Architecture

### High level

Each application is a static Vite + React SPA. After build, the entire
app collapses to a folder of static files (`dist/`) that is served by
the `serve` npm package inside a Docker container. There is no
server-side rendering and no runtime server-side code.

```
                     Internet
                        │
          DNS A: khrum-khrum.info, v1.khrum-khrum.info,
                 v2.khrum-khrum.info  (all → VM public IP)
                        │
                        ▼
        ┌────────────────────────────────────────────┐
        │  Ubuntu VM                                 │
        │                                            │
        │  ┌──────────────────────────────────────┐  │
        │  │  Caddy 2 (Docker)                    │  │
        │  │   - listens on :80, :443             │  │
        │  │   - terminates TLS (ACME, autorenew) │  │
        │  │   - host-based reverse proxy         │  │
        │  └────────┬───────────────────┬─────────┘  │
        │           │                   │            │
        │           ▼                   ▼            │
        │  ┌─────────────────┐ ┌─────────────────┐   │
        │  │  app-v1 (Docker)│ │  app-v2 (Docker)│   │
        │  │  serve dist :5173│ │  serve dist :5173│  │
        │  │  repo: v1, main│ │  repo: v2, main│  │
        │  └─────────────────┘ └─────────────────┘   │
        └────────────────────────────────────────────┘
                        │
                        ▼
                3rd-party: mc.yandex.ru
              (Metrika analytics ingest)
```

Key points:

- The two app containers do **not** publish ports to the host. They are
  reachable only over the internal Docker network from Caddy.
- Caddy obtains and renews Let's Encrypt certificates automatically
  (one cert per `*.khrum-khrum.info` host) provided ports 80 and 443 are
  reachable from the public internet and the `caddy_data` volume
  persists.
- The whole stack is described by a single `docker-compose.yml` at
  `/data/khrum_khrum/docker-compose.yml`.

### On-VM filesystem layout

```
/data/khrum_khrum/
├── docker-compose.yml      # Caddy + app-v1 + app-v2
├── Caddyfile               # Reverse proxy config
├── .env                    # IMAGE_V1=..., IMAGE_V2=...  (rewritten by deploy)
├── caddy_data/             # Caddy persistent state (certs, ACME account)
├── caddy_config/           # Caddy autosaved config
├── v1/                     # Reserved per-app path for app 1 (currently empty)
└── v2/                     # Reserved per-app path for app 2 (currently empty)
```

`v1/` and `v2/` are reserved for per-app state. The current apps are
fully static so these directories are empty; they exist as documented
mountpoints in case a future iteration grows persistent state.

### Source layout

The two app repos share the following shape. What differs is the
content of the React source and (optionally) the Yandex Metrika counter
id in `index.html`.

```
.
├── Dockerfile              # node:22-alpine + `serve`
├── docker-compose.yml      # Local development only — production compose lives on the VM
├── index.html              # Vite entry; embeds the branch's Yandex Metrika counter
├── vite.config.ts          # base: '/khrum-khrum/' (overridden to '/' in Dockerfile)
├── eslint.config.js
├── tsconfig*.json
├── package.json
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── dishes/             # 150 static images: 1.jpg .. 150.jpg
└── src/
    ├── main.tsx            # React 19 createRoot mount in StrictMode
    ├── App.tsx             # ConfigProvider → FavoritesProvider → HashRouter
    ├── index.css
    ├── styles/global.css
    ├── pages/              # HomePage / RecipePage / FavoritesPage
    ├── components/         # Header / SearchBar / FilterPanel / RecipeCard / RecipeList / RecipeDetail
    ├── context/FavoritesContext.tsx     # localStorage-backed, key: khrum_favorites
    ├── hooks/              # useFilters, useRecipes
    ├── services/           # analyticsService, recipeService, imageService
    ├── data/               # recipes-1.json, recipes-2.json, recipes-3.json (50 + 50 + 50)
    └── types/index.ts
```

### Routing

`HashRouter` is used (not `BrowserRouter`). Routes are encoded in the
URL fragment (`#/recipe/42`). Consequences:

- The web server only ever needs to serve `index.html` for any URL — no
  SPA fallback / `try_files` rules are required, and Caddy doesn't need
  any custom handlers.
- Deep links work even if the app is later moved under a sub-path.
- All state after `#` is invisible to the server, so server-side
  analytics cannot see SPA paths; this is why `YMPageTracker` reports
  each route change to Yandex Metrika by hand
  (`src/App.tsx:23`).

Defined routes (`src/App.tsx`):

| Path            | Page          |
| --------------- | ------------- |
| `/`             | HomePage      |
| `/recipe/:id`   | RecipePage    |
| `/favorites`    | FavoritesPage |

If a recipe id from the URL is unknown, the user is silently redirected
to `/` (`src/pages/RecipePage/RecipePage.tsx:22`).

### Data flow

1. All three `recipes-*.json` files are imported statically by
   `src/services/recipeService.ts` and concatenated into a single
   in-memory array on first import. Data ships inside the JS chunks;
   there is no runtime fetch.
2. `useRecipes(filters)` returns the memoized filtered list. The filter
   predicate combines text search across name / short description /
   full description / ingredient names, plus structured filters
   (mealType, cookingMethod, meatType, difficulty, isVegetarian,
   isVegan) and numeric ceilings for cookingTime and calories.
3. The favorites list is held in `FavoritesContext` and persisted to
   `localStorage` under the key `khrum_favorites`. Browser-local;
   cross-device sync is intentionally not provided.

> Implementation note (carries forward from the original app): `Recipe.id`
> is typed as `string` in `src/types/index.ts` and the JSON contains
> string ids (`"id": "1"` … `"150"`), but `FavoritesContext` declares
> `toggleFavorite(id: number)` and stores `number[]`. Call sites pass
> `recipe.id` (string) into both `toggleFavorite` and `isFavorite`.
> `Array.prototype.includes` uses `===`, so mixed-type comparisons never
> match. Fix is a one-line change (use `string` everywhere). The build
> script is `tsc -b && vite build` — if `tsc -b` rejects this today it
> has to be reconciled before the Dockerfile can build the image.

### Analytics

The Yandex Metrika tag is loaded inline from `index.html`. Each app has
its own counter id (the current `109042107` belongs to app 1; app 2
should use a separate counter so reports don't mix). The tag is
configured with `clickmap`, `trackLinks`, `accurateTrackBounce`,
`webvisor` and `ecommerce: 'dataLayer'` enabled.
`src/services/analyticsService.ts` wraps `window.ym(...)`:

| Function                | Yandex method | Goal name           | Where it fires                                |
| ----------------------- | ------------- | ------------------- | --------------------------------------------- |
| `trackPageHit`          | `hit`         | —                   | `App.tsx:26` (every SPA route change)         |
| `trackRecipeCardClick`  | `reachGoal`   | `recipe_card_click` | `RecipeCard.tsx:27`                           |
| `trackRecipeView`       | `reachGoal`   | `recipe_view`       | `RecipePage.tsx:20`                           |
| `trackRecipeScroll`     | `reachGoal`   | `recipe_scroll`     | `RecipePage.tsx` (25 / 50 / 75 / 100 % depth) |
| `trackRecipeTimeSpent`  | `reachGoal`   | `recipe_time_spent` | `RecipePage.tsx:32` (effect cleanup)          |
| `trackScenarioClick`    | `reachGoal`   | `scenario_click`    | exported but not currently called             |
| `trackFilterApplied`    | `reachGoal`   | `filter_applied`    | `HomePage.tsx`, `FilterPanel.tsx`             |
| `trackFilterReset`      | `reachGoal`   | `filter_reset`      | `HomePage.tsx`, `FilterPanel.tsx`             |
| `trackSearchPerformed`  | `reachGoal`   | `search_performed`  | `HomePage.tsx:23` (only when query length ≥ 2)|

`HashRouter` was chosen, so SPA navigations do not produce a real page
reload and Metrika would otherwise miss them — the explicit
`trackPageHit` call in `YMPageTracker` is the bridge.

---

## 3. Functionality

User-visible features (each app starts with this baseline; the two
repos can diverge freely):

- **Recipe catalog (HomePage).** A card grid of 150 recipes with a hero
  search input, a multi-control filter panel and a result counter.
  Counter shows "Все рецепты — 150" when no filtering is active and
  "Найдено: N" otherwise (`HomePage.tsx:60`).
- **Free-text search.** Case-insensitive substring match on name, short
  description, full description, and ingredient names.
- **Filters.** Meal type, cooking method, meat type, difficulty, max
  cooking time (5–180 min), max calories (50–2000 kcal), vegetarian /
  vegan toggles. Reset button visible only when at least one filter is
  changed (`FilterPanel.tsx:58`).
- **Recipe details (RecipePage).** Hero image, description, four stat
  badges (calories / minutes / servings / difficulty), ingredients list,
  numbered preparation steps, back button (prefers `history.back()`,
  falls back to `/`).
- **Favorites.** Heart icon toggles favorites; persisted in
  `localStorage`, browser-local.
- **Internationalization.** UI labels are Russian only; no i18n
  framework is wired in.
- **Analytics.** Every meaningful interaction is reported to Yandex
  Metrika (table above).

Out of scope (intentionally not implemented in either app): user
accounts, ratings, comments, server-side search, image uploads, admin /
CMS, server-side analytics, payments.

---

## 4. Technologies

Runtime dependencies (`package.json`):

- **React 19.2** + **react-dom 19.2** — UI runtime.
- **react-router-dom 7** — `HashRouter`, `Routes`, `Route`, `useParams`,
  `useNavigate`, `useLocation`.
- **antd 6** + **@ant-design/icons 6** — UI components and icon set.

Build / dev tooling:

- **Vite 8** with **@vitejs/plugin-react 6**.
- **TypeScript ~6.0** (project references via `tsconfig.json`,
  `tsconfig.app.json`, `tsconfig.node.json`).
- **ESLint 9** + **typescript-eslint 8** + `eslint-plugin-react-hooks`
  + `eslint-plugin-react-refresh`.

Runtime / external services:

- **Yandex Metrika** (per-app counter id, loaded from
  `https://mc.yandex.ru/metrika/tag.js`).

Container / packaging:

- **node:22-alpine** as the build and runtime base image.
- **`serve`** (npm package, installed globally inside the image) as the
  static file server. Each app container listens on `:5173` inside its
  Docker network. Ports are not published to the host in production.

Reverse proxy:

- **caddy:2-alpine** as the public-facing entry point. Terminates TLS,
  routes by `Host`, and renews Let's Encrypt certificates automatically.

There is no backend, no database, no message broker, no cache.

---

## 5. Building the project

### Prerequisites

- Node.js 22.x LTS (matching the Dockerfile base) and npm 10+.
- Docker 24+ and `docker compose` v2 if you want the containerized build.

### Local development

```bash
npm ci              # reproducible install from package-lock.json
npm run dev         # Vite dev server with HMR, default http://localhost:5173
```

`vite.config.ts` sets `base: '/khrum-khrum/'`, harmless in dev. For
production builds the base is overridden to `/` in the Dockerfile.

### Production build (local smoke test)

```bash
npm run build       # `tsc -b` then `vite build`
npm run preview     # serve dist/ locally
npm run lint        # ESLint over the source tree
```

Output is written to `dist/`. To match the production base path:

```bash
npm run build -- --base=/
```

### Docker build (single app, local)

```bash
docker build -t khrum-khrum:local .
docker run --rm -p 5174:5173 khrum-khrum:local
# → http://localhost:5174
```

The repo's `docker-compose.yml` is for **local development only**; the
production compose file lives on the VM at
`/data/khrum_khrum/docker-compose.yml` (see `DEPLOY.md` §4).

### Build characteristics worth noting

- The current Dockerfile installs all dependencies (incl.
  devDependencies), builds, and keeps the build toolchain in the
  runtime image. Simple but the image is larger than it needs to be.
  A multi-stage build copying only `dist/` and `serve` into a minimal
  stage would shrink it considerably.
- `serve -s` serves any unknown path as `index.html`. With `HashRouter`
  this fallback is not strictly required; harmless to keep.
- The `deploy` / `predeploy` npm scripts reference `gh-pages`, which is
  not declared as a dependency. They are leftovers from the Vite
  template and are not used by the deployment paths described here.

---

## 6. Deployment shape

The deployment is a single Docker Compose stack on a single Ubuntu VM:

- **Caddy** (caddy:2-alpine) terminates TLS for the three host names,
  proxies `v1.khrum-khrum.info` to `app-v1:5173`, proxies
  `v2.khrum-khrum.info` to `app-v2:5173`, and returns HTTP 404 with a
  small explanatory body for `khrum-khrum.info`.
- **app-v1** runs the image built from `web-analytics-v1` repo's `main`.
- **app-v2** runs the image built from `web-analytics-v2` repo's `main`.
- Caddy auto-issues per-host certificates from Let's Encrypt at first
  startup and renews them roughly 30 days before expiry. State is held
  in the `caddy_data` Docker volume (mounted from
  `/data/khrum_khrum/caddy_data`).
- Each repo's GitHub Actions workflow builds an image, pushes it to
  the container registry, and rolls out **only that app's** service on
  the VM. Caddy and the other app are untouched.

See `DEPLOY.md` for the concrete files and step-by-step instructions.

---

## 7. Non-functional requirements / recommendations

### Security

- **TLS only.** Caddy redirects plain HTTP to HTTPS by default. HSTS is
  set in the Caddyfile.
- **Tight inbound rules.** Only `:80` and `:443` are reachable from the
  public internet. SSH (`:22`) is restricted to a known IP allowlist
  (or replaced with Azure Bastion).
- **No application secrets.** The build is purely static; the only
  third-party identifier is the Yandex Metrika counter id, which is
  intentionally public. There are no runtime secrets to inject.
- **CI / deploy secrets.** The deploy SSH private key and host key
  fingerprint live in GitHub Actions encrypted secrets (or are pulled
  from Azure Key Vault), never in the repo. The same secret set is
  configured in each app repo. See `DEPLOY.md` §6.
- **Image registry.** Default is **public GHCR**: zero auth on the VM,
  zero PATs to rotate, and the source is already public so the image
  adds no real disclosure. Private GHCR or ACR are documented
  alternatives in `DEPLOY.md` §3.
- **Container hardening.** App containers are pinned to the
  `sha-<commit>` tag on each rollout (not `latest`). Caddy is pinned to
  a specific `caddy:2.x` minor version. Both are restarted with
  `restart: unless-stopped`.
- **CSP.** A Content-Security-Policy header (delivered by Caddy) helps
  offset XSS risk. The inline Metrika snippet in `index.html` means a
  strict `script-src 'self'` will not work as-is — use
  `'unsafe-inline'`, a nonce-based policy, or externalize the snippet.
  At minimum, `mc.yandex.ru` must be allowed in `script-src`,
  `connect-src` and `img-src`. If webvisor remains enabled, consult
  Yandex Metrika's current CSP guidance for the additional hosts it
  loads (the list changes over time).
- **Privacy / GDPR.** Metrika sets cookies and records sessions
  (webvisor enabled). Depending on audience jurisdiction, a
  cookie-consent banner and a privacy notice referencing Metrika are
  likely required. Product-level concern.
- **Dependency hygiene.** Enable Dependabot or `npm audit` in CI; React
  19, Vite 8 and antd 6 evolve quickly.

### Observability and maintenance

- **Container logs.** `serve` and Caddy both write to stdout. The
  `docker-compose.yml` configures `json-file` log rotation (10 MB × 5
  files). Forward to Azure Monitor / Log Analytics for centralized
  retention if required.
- **Health checks.** Compose-level `healthcheck:` blocks probe `/` on
  each app container (`wget` against `:5173`) and the Caddy admin
  endpoint (`:2019/config/`). `restart: unless-stopped` plus
  `depends_on` with `condition: service_healthy` keep the stack honest.
- **Uptime monitoring.** External pings against the public DNS names
  catch issues that internal health checks miss.
- **Patching.** Schedule unattended-upgrades for the OS; recreate
  containers monthly so base images pick up Alpine patches; refresh
  `node:22-alpine` and `caddy:2-alpine` periodically.
- **Backup.** The application is stateless. The only thing worth
  backing up is `/data/khrum_khrum/caddy_data` (so cert renewals don't
  hit Let's Encrypt rate limits after a VM restore) and the VM disk
  itself for OS / compose / Caddyfile config. The Git repository is
  already on GitHub.

### Reliability and capacity

- A single small VM (1 vCPU / 1 GB RAM) handles thousands of concurrent
  users for both static apps. Caddy adds negligible overhead.
- For HA, run two VMs behind Azure Load Balancer / Front Door, or skip
  the VM entirely and host on Azure Static Web Apps. The Docker path
  here is appropriate when a VM has already been provisioned.

---

## 8. Azure infrastructure recommendations

The application is intended to live on an existing Azure VM inside a
virtual network with an NSG. Recommended set of Azure resources:

| Resource                          | Purpose                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Resource Group                    | Single RG per environment (`rg-khrum-prod`, `rg-khrum-staging`).                                 |
| Virtual Network + Subnet          | The existing VNet is fine; place the VM in a dedicated subnet.                                   |
| Network Security Group (NSG)      | Inbound: TCP 80, 443 from `Internet`; TCP 22 from a specific source (admin IP / Bastion subnet) only. Deny everything else. Outbound: default. |
| Public IP (static)                | Static SKU=Standard, associated with the VM NIC. Three DNS A records (`khrum-khrum.info`, `v1.khrum-khrum.info`, `v2.khrum-khrum.info`) point here. |
| Azure DNS Zone (optional)         | If the domain is hosted in Azure DNS, manage A records there; otherwise just point the existing external A records at the static public IP. |
| Azure Key Vault                   | Store: deploy SSH private key, GHCR PAT (only if private), any future secrets. Grant the VM's system-assigned managed identity `get`/`list` on secrets. |
| Azure Container Registry (ACR)    | *Optional* alternative to GHCR. Use ACR if you want registry traffic to stay inside Azure or pull via managed identity (no on-disk PAT). |
| Log Analytics workspace           | Centralized logging. Install the Azure Monitor Agent on the VM and configure data collection rules for syslog and Docker `json-file` logs (or switch the daemon to `journald`). |
| Azure Monitor alerts              | CPU / memory / disk / availability test failures. Wire to an Action Group. |
| Azure Backup                      | Daily VM-level backup with a 7–30 day retention policy.                                           |
| Microsoft Defender for Cloud      | At minimum the free tier; ideally Defender for Servers Plan 2 for endpoint protection and JIT SSH. |
| Azure Bastion (recommended)       | Replaces public SSH exposure. If adopted, the NSG rule for port 22 from the public internet can be removed entirely. |

### Identity and secrets flow

- Enable **system-assigned managed identity** on the VM.
- Grant that identity `get` / `list` on Key Vault secrets and `AcrPull`
  on ACR (if used).
- The VM reads what it needs from Key Vault via the Instance Metadata
  Service rather than carrying long-lived credentials on disk.

### Cost

The smallest practical VM SKU (`Standard_B1s` or `B2s`) handles both
static apps comfortably. Running costs are dominated by the VM and any
Defender add-ons; egress traffic is negligible because Yandex Metrika
offloads analytics ingest to a third party.

### When to consider not using a VM at all

If the existing-VM constraint is dropped, both apps are textbook fits
for **Azure Static Web Apps** (free tier covers most use cases,
includes a CDN, custom domains and managed TLS) or **Azure Storage
static website behind Azure Front Door**. Both eliminate VM patching,
container rebuilds and the entire Caddy/ACME story.
