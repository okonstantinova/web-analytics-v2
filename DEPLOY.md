# Deployment guide — two repos, single VM, Caddy reverse proxy

This document is the step-by-step playbook for shipping both
`khrum-khrum` apps to a single Ubuntu VM. The runtime shape is
described in `CLAUDE.md` §6; this file is the **how**.

The model:

- **Two public repos**, one per app: `web-analytics-v1` and
  `web-analytics-v2`. Each tracks a single long-lived branch named
  `main`.
- A push to `main` of either repo triggers a **fully automatic**
  build-and-deploy: the workflow builds a Docker image, pushes it to
  GHCR, SSHes to the VM, and restarts only that one app's container.
  See §5.1 for the rationale and how to switch to manual deploys.
- **Caddy** runs as a third container on the same VM. It owns the
  public ports (80/443), terminates TLS, and routes by `Host` header.
  TLS certificates are issued and renewed automatically by Caddy using
  Let's Encrypt — no certbot, no systemd timers.

Images are built **once** in CI and **pulled** on the VM. Rollouts are
fast, identical across environments, and trivially reversible.

### Doc layout

- **§1–4 — Shared VM setup.** Do these once. They configure the host,
  the compose stack, the Caddyfile, and the registry policy that
  serves *both* apps.
- **§5–8 — Per-repo setup.** Repeat for each app repo. This file is in
  the v1 repo and uses v1 examples throughout; the v2 repo's
  `DEPLOY.md` is structurally identical with `v1`→`v2`,
  `web-analytics-v1`→`web-analytics-v2` substitutions.
- **§9–11 — Operations, rollback, troubleshooting.**

---

## 1. Prerequisites

### Domain and DNS

Three DNS **A** records, all pointing to the VM's public IP:

| Record                  | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `khrum-khrum.info`      | Apex; Caddy serves a 404 with valid TLS (see §4.2)          |
| `v1.khrum-khrum.info`   | App 1 (built from the `web-analytics-v1` repo, `main`)    |
| `v2.khrum-khrum.info`   | App 2 (built from the `web-analytics-v2` repo, `main`)    |

DNS must resolve **before** the first Caddy startup. Without working
DNS, the ACME HTTP-01 challenge fails and Caddy falls back to internal
self-signed certs that the browser will reject.

### GitHub

For each app repo:

- The repo is public, with a single `main` branch.
- Repository **Settings → Actions → General → Workflow permissions**
  is set to "Read and write permissions" (so `GITHUB_TOKEN` can push to
  GHCR).
- Branch protection on `main`: require PR review before merge (this
  is the safety net for "every push to main ships").

### VM

- Ubuntu 22.04 / 24.04 LTS.
- A non-root deploy user (`deploy`) with Docker access (see §2.3).
- An SSH server reachable from GitHub-hosted runners (or via a
  self-hosted runner inside your VNet — recommended for Azure; see §10).

---

## 2. VM bootstrap (one-time, shared)

This section is meant to be read and executed top-to-bottom. The first
sub-section runs **on your laptop** and produces artifacts that later
sub-sections (and §6.1) consume; everything else runs **on the VM** as
root (or via `sudo`). These steps are done **once** and serve both apps.

### 2.0 Before you SSH to the VM — local prerequisites

Two artifacts have to exist on your laptop before the on-VM steps make
sense:

1. an SSH key pair for the `deploy` user (its public half goes into
   §2.3's `authorized_keys`; its private half goes into both repos'
   `SSH_KEY` secret in §6.1);
2. the VM's SSH host-key fingerprint (it goes into both repos'
   `SSH_KNOWN_HOSTS` secret in §6.1).

The **same** key pair is used for both repos — one deploy identity per
VM. Both repos' workflows also connect through the **same SSH hostname**
(the apex `khrum-khrum.info`), so one `ssh-keyscan` produces a
`known_hosts` file that works for both. The SSH endpoint is purely a
transport detail; each workflow still smoke-tests its own
`v1.`/`v2.` URL after the deploy. Run on your local machine:

```bash
# 1. Generate the deploy key pair. -N '' = no passphrase (required for
#    non-interactive use from GitHub Actions).
ssh-keygen -t ed25519 -C deploy@github-actions -f ./id_ed25519 -N ''

# 2. Capture the VM's SSH host keys via the apex. Safe to run as soon
#    as the VM has a public IP, DNS resolves, and sshd is reachable
#    on :22 — no account on the VM is needed, this is a transport-layer
#    probe. (All three DNS names point to the same VM, so the apex,
#    v1., and v2. would each return identical host keys; the apex is
#    chosen here because it's the SSH_HOST both repos will use.)
ssh-keyscan -p 22 khrum-khrum.info | tee ./vm_known_hosts
```

You'll end up with three files. They feed the rest of this guide:

| File                  | Used in | Purpose                                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------ |
| `./id_ed25519.pub`    | §2.3    | Pasted into the VM's `/home/deploy/.ssh/authorized_keys`.                |
| `./id_ed25519`        | §6.1    | Pasted into the `SSH_KEY` secret in **both** app repos.                  |
| `./vm_known_hosts`    | §6.1    | Pasted into the `SSH_KNOWN_HOSTS` secret in **both** app repos.          |

Keep these files locally until §6.1 is done; then you can delete them
(the data lives in the VM and in GitHub secrets after that).

### 2.1 OS hardening basics

```bash
apt-get update && apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades   # answer "yes"
```

### 2.2 Docker Engine + Compose plugin

Install Docker from Docker's official APT repository (the distro
`docker.io` package lags):

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version    # sanity check
```

### 2.3 Deploy user

Before pasting the block below, **replace the placeholder line**
`ssh-ed25519 AAAA... deploy@github-actions` with the exact one-line
contents of `./id_ed25519.pub` from §2.0. If you skip the substitution,
the deploy account will trust a non-existent key and the workflow's
SSH step will fail.

```bash
adduser --disabled-password --gecos '' deploy
usermod -aG docker deploy

# Authorize the public key generated in §2.0. The private half goes
# into both repos' SSH_KEY secret in §6.1.
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cat > /home/deploy/.ssh/authorized_keys <<'EOF'
ssh-ed25519 AAAA... deploy@github-actions
EOF
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
```

### 2.4 Application directories

```bash
install -d -m 0755 -o deploy -g deploy /data
install -d -m 0755 -o deploy -g deploy /data/khrum_khrum
install -d -m 0755 -o deploy -g deploy /data/khrum_khrum/v1
install -d -m 0755 -o deploy -g deploy /data/khrum_khrum/v2
install -d -m 0755 -o deploy -g deploy /data/khrum_khrum/caddy_data
install -d -m 0755 -o deploy -g deploy /data/khrum_khrum/caddy_config
```

### 2.5 SSH hardening (recommended)

In `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PermitRootLogin no
```

Then `systemctl restart ssh`.

### 2.6 Firewall (host-level UFW)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH — restrict by source IP if possible
ufw allow 80/tcp        # HTTP (also needed for ACME HTTP-01)
ufw allow 443/tcp       # HTTPS
ufw enable
```

### 2.7 Cloud NSG / security group

Mirror the same rules at the cloud layer. For Azure NSG:

| Direction | Priority | Source            | Destination | Service / Port | Action |
| --------- | -------- | ----------------- | ----------- | -------------- | ------ |
| Inbound   | 100      | `<admin IP/CIDR>` | Any         | TCP 22         | Allow  |
| Inbound   | 110      | `Internet`        | Any         | TCP 80         | Allow  |
| Inbound   | 120      | `Internet`        | Any         | TCP 443        | Allow  |
| Inbound   | 4096     | Any               | Any         | Any            | Deny   |
| Outbound  | —        | default           | default     | default        | Allow  |

If using Azure Bastion, drop the inbound 22 rule entirely.

---

## 3. Container registry — recommendation

Both repos are public, both builds are purely static (no embedded
secrets), and the images contain only compiled JS / CSS / static assets
that are already shipped to every visitor's browser. Therefore:

> **Recommendation: use public GHCR packages, one per repo.**
>
> - Source code is already public, so the image discloses nothing new.
> - Public packages need no authentication on the VM — no PAT to
>   create, store or rotate.
> - GitHub Actions' built-in `GITHUB_TOKEN` can push without any extra
>   org-level configuration.
> - Free; no per-pull rate limits beyond GitHub's anonymous limits
>   (which are generous for a single-VM deploy).

**If you must use a private registry**, the alternatives in order of
operational simplicity:

1. **Private GHCR.** Same workflow; one extra step on the VM:
   ```bash
   echo "<fine-grained PAT, scoped read:packages on these packages>" \
     | sudo -u deploy docker login ghcr.io -u <github-username> --password-stdin
   ```
   PATs must be rotated; that's the recurring cost.

2. **Azure Container Registry (ACR).** Push from CI using a service
   principal with `AcrPush`; pull from the VM via the VM's
   system-assigned managed identity (`AcrPull`). No on-disk
   credentials. Best if you already operate inside Azure.

The rest of this document assumes **public GHCR**. Switching to private
GHCR or ACR changes only (a) the VM's `docker login` step and (b) the
registry/image references in the workflow.

To make the GHCR package public after the first push (per repo):

> GitHub repo → Packages → `<package-name>` → Package settings →
> Danger zone → Change visibility → Public.

(The package is created automatically on the first successful push.)

---

## 4. The on-VM stack (one-time, shared)

Place all four files at `/data/khrum_khrum/`, owned by `deploy:deploy`.

### 4.1 `docker-compose.yml`

```yaml
name: khrum-khrum

networks:
  edge:

services:
  caddy:
    image: caddy:2-alpine
    container_name: khrum-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"   # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy_data:/data
      - ./caddy_config:/config
    networks: [edge]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:2019/config/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  app-v1:
    image: ${IMAGE_V1}
    container_name: khrum-app-v1
    restart: unless-stopped
    expose:
      - "5173"
    networks: [edge]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5173/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  app-v2:
    image: ${IMAGE_V2}
    container_name: khrum-app-v2
    restart: unless-stopped
    expose:
      - "5173"
    networks: [edge]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:5173/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

Notes:

- Only `caddy` publishes ports to the host. `app-v1` / `app-v2` are
  reachable only from inside the `edge` network.
- `IMAGE_V1` / `IMAGE_V2` are interpolated from `/data/khrum_khrum/.env`
  (created in §4.3). Each repo's deploy workflow rewrites **only its
  own** line in that file on each rollout.
- `caddy_data` (mounted at `/data` inside the container) is where Caddy
  persists its ACME account and issued certificates. Back this up.

### 4.2 `Caddyfile`

The apex `khrum-khrum.info` is intentionally non-serving: Caddy
acquires a valid TLS cert for it and returns a clean HTTP 404 with a
short explanatory body. Choosing a clear error (rather than a silent
TCP reset or "no response") gives you:

- Valid TLS, so browsers don't show a cert warning.
- A debuggable response — operators and uptime monitors get a
  deterministic answer.
- A pointer for anyone who lands on the bare domain (the body links
  them to the v1/v2 hosts).

```caddy
{
    # Email Let's Encrypt uses for cert-expiry notifications.
    # Change to a mailbox you actually monitor.
    email ops@khrum-khrum.info

    # Use the staging endpoint while testing the setup to avoid hitting
    # Let's Encrypt production rate limits. Comment out for production.
    # acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}

(common) {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        # Adjust CSP if you tighten the inline Metrika snippet.
        # Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://mc.yandex.ru; img-src 'self' data: https://mc.yandex.ru; connect-src 'self' https://mc.yandex.ru;"
    }
}

v1.khrum-khrum.info {
    import common
    reverse_proxy app-v1:5173 {
        health_uri      /
        health_interval 30s
        health_timeout  5s
    }
}

v2.khrum-khrum.info {
    import common
    reverse_proxy app-v2:5173 {
        health_uri      /
        health_interval 30s
        health_timeout  5s
    }
}

# Apex — DNS exists, cert is issued, but nothing is served.
khrum-khrum.info {
    import common
    header Content-Type "text/plain; charset=utf-8"
    respond "Not Found. This service is hosted at https://v1.khrum-khrum.info and https://v2.khrum-khrum.info" 404
}
```

Notes:

- Caddy auto-issues one certificate **per host name** by default; all
  three domains end up with separate (but auto-renewed) certs.
- Caddy renews each cert about 30 days before expiry. Renewal needs
  ports 80/443 open and the `caddy_data` volume to persist.
- The apex still requires a valid A record (or AAAA) and TLS issuance
  to behave correctly — without it, a client hitting
  `https://khrum-khrum.info` gets a TLS error rather than the intended
  404. Don't remove the DNS record.

### 4.3 `.env`

Create empty placeholders so the first `docker compose up -d caddy`
doesn't warn about missing variables:

```bash
sudo -u deploy tee /data/khrum_khrum/.env >/dev/null <<'EOF'
IMAGE_V1=ghcr.io/<owner>/web-analytics-v1:latest
IMAGE_V2=ghcr.io/<owner>/web-analytics-v2:latest
EOF
```

Replace `<owner>` with your GitHub user/org (lowercase). The `:latest`
tags don't need to exist yet; Caddy starts independently and the app
services fail to pull until each repo's first deploy. After the first
deploy from each repo, the corresponding line is rewritten with a
pinned `sha-<commit>` reference.

### 4.4 First start

```bash
cd /data/khrum_khrum
sudo -u deploy docker compose up -d caddy
sudo -u deploy docker compose logs -f caddy   # watch ACME issuance
```

Once Caddy logs `certificate obtained successfully` for all three
hosts, hit:

- `https://v1.khrum-khrum.info/` → **502 Bad Gateway** until the first
  v1 deploy lands (expected).
- `https://v2.khrum-khrum.info/` → **502 Bad Gateway** until the first
  v2 deploy lands (expected).
- `https://khrum-khrum.info/` → **404** with the explanatory body
  (expected, this is the final state).

---

## 5. Per-repo: deploy trigger

Do this **once per repo**. This section uses `web-analytics-v1`
examples; substitute `v2` / `web-analytics-v2` for the other repo.

### 5.1 Auto on push to `main` vs manual — recommendation

> **Recommendation: fully automatic on push to `main`,
> with branch protection requiring PR review.**

Reasoning:

- Each app is **static, public, no auth, no user data**. The blast
  radius of a bad deploy is "the site shows broken content for a few
  minutes" — fixable by a hard refresh and a one-click re-run of a
  previous workflow (see §8 Rollback).
- Branch protection (PR review on `main`) supplies the human gate
  where it matters: at merge time, not at deploy time. Adding a
  *second* manual gate ("merge AND then click Deploy") is friction
  without benefit at this scale.
- A failing deploy fails noisily (smoke test returns non-2xx, workflow
  goes red). The operator finds out immediately.

The workflow in §6 ships in this auto-on-push mode by default. If you
later want to switch to manual:

- **Option A — manual-only.** Remove the `push:` trigger from
  `on:` (keep `workflow_dispatch:`). Every deploy becomes "go to
  Actions → Run workflow → pick branch".
- **Option B — auto build, manual deploy.** Keep the `push:` trigger
  but require human approval to enter the `production` environment:
  add a `production` environment in **Settings → Environments** and
  set "Required reviewers". The `deploy` job pauses until approved.
  Builds keep happening; only deploys gate.

### 5.2 Concurrency and serialisation

The workflow's `concurrency` block already serialises deploys within a
single repo so two overlapping pushes can't fight over the VM. Since
v1 and v2 live in **separate repos**, their workflows run independently
and can deploy in parallel — which is fine because each deploy
restarts only its own service (`--no-deps`).

---

## 6. Per-repo: GitHub configuration

Do this **once per repo**.

### 6.1 Secrets

**Repository → Settings → Secrets and variables → Actions → New
repository secret**. The same five secrets in both repos, with
**identical values** — both workflows SSH to the apex as a shared
deploy endpoint:

| Name              | Value                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| `SSH_HOST`        | `khrum-khrum.info` — the apex. All three DNS names resolve to the same VM, but the apex is used as the canonical SSH endpoint so a single `known_hosts` entry works for both repos. Use a DNS name (not the IP) so the host key fingerprint is stable across IP changes. |
| `SSH_USER`        | `deploy`                                                                               |
| `SSH_PORT`        | `22`                                                                                   |
| `SSH_KEY`         | The **private** key (`./id_ed25519`) generated in §2.0.                                |
| `SSH_KNOWN_HOSTS` | Contents of `./vm_known_hosts` captured in §2.0.                                       |

No registry credentials are needed (the workflow uses the built-in
`GITHUB_TOKEN` to push to GHCR; the package is public so the VM doesn't
authenticate to pull).

### 6.2 SSH key pair (already prepared in §2.0)

Don't generate a new key here — the `deploy` key pair was already
created on your laptop in §2.0, and its public half was authorised on
the VM in §2.3. The same pair serves both repos: one deploy identity
per VM. Feed the existing files into the secrets in §6.1:

- `SSH_KEY` ← contents of `./id_ed25519`
- `SSH_KNOWN_HOSTS` ← contents of `./vm_known_hosts`

Before relying on the workflow, verify the key works end-to-end from
your laptop. Use the apex — that's the hostname both repos' workflows
will use:

```bash
ssh -p 22 -i ./id_ed25519 deploy@khrum-khrum.info 'docker version'
```

A printed Docker version block means the deploy account is correctly
wired up. After this confirmation you can delete `./id_ed25519` and
`./vm_known_hosts` from your laptop — the data lives in the VM and in
GitHub secrets from now on. (You can always regenerate by repeating
§2.0 and re-running §2.3 with the new public key.)

### 6.3 Branch and registry settings

- **Settings → General → Default branch**: `main`.
- **Settings → Branches → Branch protection rule** for `main`:
  require PR review and passing checks before merge. This is the
  trade-off that makes "push to main → auto-deploy" safe.
- **Settings → Actions → General → Workflow permissions**: "Read and
  write permissions" (required for the workflow's GHCR push).

---

## 7. Per-repo: the GitHub Actions workflow

Commit the following to `.github/workflows/deploy.yml`. This file is
the v1 variant; in the v2 repo, change the two `APP_*` values at the
top.

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

env:
  # Repo-specific. In the v2 repo: APP_NAME=v2, APP_HOST=v2.khrum-khrum.info.
  APP_NAME: v1
  APP_HOST: v1.khrum-khrum.info

  REGISTRY: ghcr.io
  IMAGE_REPO: ${{ github.repository }}    # e.g. <owner>/web-analytics-v1

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.out.outputs.image }}
    steps:
      - uses: actions/checkout@v4

      - id: lc
        # GHCR rejects uppercase in the image path.
        run: |
          echo "image_repo=$(echo '${{ env.REGISTRY }}/${{ env.IMAGE_REPO }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/setup-buildx-action@v3

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.lc.outputs.image_repo }}
          tags: |
            type=sha,prefix=sha-,format=long
            type=raw,value=latest,enable={{is_default_branch}}

      - uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - id: out
        run: echo "image=${{ steps.lc.outputs.image_repo }}:sha-${{ github.sha }}" >> "$GITHUB_OUTPUT"

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    # Uncomment to require manual approval before deploying (see §5.1 option B):
    # environment: production
    steps:
      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.SSH_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts

      - name: Roll out
        env:
          APP:   ${{ env.APP_NAME }}
          IMAGE: ${{ needs.build-and-push.outputs.image }}
        run: |
          ssh -p "${{ secrets.SSH_PORT }}" -i ~/.ssh/id_ed25519 \
              -o IdentitiesOnly=yes \
              "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}" \
              APP="$APP" IMAGE="$IMAGE" bash -se <<'EOF'
            set -euo pipefail
            cd /data/khrum_khrum
            VAR="IMAGE_$(echo "$APP" | tr '[:lower:]' '[:upper:]')"
            # Idempotent in-place update of the chosen IMAGE_* line.
            if grep -qE "^${VAR}=" .env; then
              sed -i.bak -E "s|^${VAR}=.*|${VAR}=${IMAGE}|" .env
            else
              echo "${VAR}=${IMAGE}" >> .env
            fi
            docker compose pull "app-${APP}"
            docker compose up -d --no-deps "app-${APP}"
            docker image prune -f
          EOF

      - name: Smoke test
        env:
          HOST: ${{ env.APP_HOST }}
        run: |
          for i in 1 2 3 4 5 6; do
            if curl -fsS --max-time 5 "https://$HOST/" >/dev/null; then
              echo "Smoke test passed for $HOST"; exit 0
            fi
            sleep 5
          done
          echo "Smoke test failed for $HOST"; exit 1
```

What it does:

1. **`build-and-push`** builds the image once (with GHA-cached layers)
   and pushes two tags: an immutable `sha-<commit>` and a moving
   `latest` (the latter only on the default branch).
2. **`deploy`** SSHes to the VM, rewrites only `IMAGE_V1` (or
   `IMAGE_V2` in the other repo) in `/data/khrum_khrum/.env` to the new
   pinned tag, pulls only that image, and restarts only that one
   service. Caddy and the other app are untouched. `docker image prune
   -f` removes dangling images so disk doesn't grow without bound.
3. **Smoke test** verifies the public URL of just the deployed app
   returns 2xx via TLS.

---

## 8. Bootstrap order

Read top-to-bottom. Each step assumes the previous ones are complete.

1. **Verify prerequisites** (§1): three DNS A records resolve, both
   repos exist on GitHub, VM is provisioned and SSH-reachable on :22.
2. **On your laptop**: generate the deploy SSH key pair and capture
   the VM host keys (§2.0). Keep the three resulting files handy.
3. **On the VM as root**: run §2.1 → §2.7 in order. In §2.3, paste
   the contents of `./id_ed25519.pub` from step 2 into the heredoc
   before executing the block.
4. **On the VM as `deploy`**: drop `docker-compose.yml`, `Caddyfile`,
   and the placeholder `.env` into `/data/khrum_khrum/` (§4.1–4.3),
   then start Caddy (§4.4). Watch the logs until certificates issue
   cleanly for all three hosts.
5. **In `web-analytics-v1` on GitHub**: configure secrets using the
   private key and host keys from step 2 (§6.1), set branch protection
   and workflow permissions (§6.3), and commit
   `.github/workflows/deploy.yml` (§7).
6. **In `web-analytics-v2` on GitHub**: same as step 5, with the two
   `APP_*` env values changed to `v2` and `v2.khrum-khrum.info`.
7. **Trigger first v1 deploy**: push to `main` in
   `web-analytics-v1`. Watch the workflow go green; verify
   `https://v1.khrum-khrum.info/` loads.
8. **Trigger first v2 deploy**: push to `main` in
   `web-analytics-v2`. Verify `https://v2.khrum-khrum.info/` loads.
9. Visit `https://khrum-khrum.info/` and confirm the **404** with the
   explanatory body — the apex is now in its intended final state.
10. (Optional) Delete `./id_ed25519`, `./id_ed25519.pub`, and
    `./vm_known_hosts` from your laptop; the data now lives only in the
    VM and in GitHub secrets.

---

## 9. Rolling back

Two equivalent options:

1. **Re-run an older successful workflow.** In the affected repo:
   Actions → Deploy workflow → pick the previous green run →
   "Re-run jobs" → "Re-run all jobs". This re-applies the matching
   `sha-<commit>` tag and restarts only that service.
2. **Manual rollback on the VM.**
   ```bash
   ssh deploy@khrum-khrum.info
   cd /data/khrum_khrum
   sed -i.bak -E "s|^IMAGE_V1=.*|IMAGE_V1=ghcr.io/<owner>/web-analytics-v1:sha-<old-commit>|" .env
   docker compose pull app-v1
   docker compose up -d --no-deps app-v1
   ```

`sha-<commit>` tags are immutable, so previous images remain pullable
as long as they aren't deleted via GHCR retention policies.

---

## 10. Operations

### Logs

```bash
docker compose -f /data/khrum_khrum/docker-compose.yml logs -f caddy
docker compose -f /data/khrum_khrum/docker-compose.yml logs -f app-v1
docker compose -f /data/khrum_khrum/docker-compose.yml logs -f app-v2
```

`json-file` rotation (10 MB × 5) is configured per service so the disk
can't fill from access logs. Switch the daemon to `journald` if you
want centralized collection on the host.

### Cert renewals

Caddy renews ~30 days before expiry. Sanity-check periodically:

```bash
docker compose -f /data/khrum_khrum/docker-compose.yml exec caddy \
  caddy list-certificates
```

If you ever restore the VM from backup, `caddy_data` must come along —
otherwise Let's Encrypt will issue fresh certs (subject to weekly rate
limits).

### Patching

```bash
sudo apt-get update && sudo apt-get -y upgrade
docker compose -f /data/khrum_khrum/docker-compose.yml pull caddy
docker compose -f /data/khrum_khrum/docker-compose.yml up -d caddy
# Then re-run the deploy workflow in each repo to refresh the app images
# against the latest node:22-alpine base.
```

---

## 11. Hardening notes

- **Self-hosted runner inside the VNet.** GitHub-hosted runners use a
  wide range of egress IPs and require public SSH on the VM. A
  self-hosted runner inside the same Azure VNet eliminates that
  exposure: the deploy job SSHes (or `docker compose pull`s) over a
  private IP, and the NSG rule for `:22` from the public internet can
  be removed.
- **Azure Bastion + JIT SSH.** If you keep using GitHub-hosted runners,
  restrict NSG inbound `:22` to known runner IP ranges *and* enable
  Defender for Servers JIT to keep the rule closed except during
  deploys.
- **Pull credentials via Key Vault + managed identity.** If you switch
  to private GHCR or ACR, mirror the images to ACR and grant the VM's
  managed identity `AcrPull` so no PAT is stored on disk.
- **Manual gate for production.** If the project grows beyond a
  sandbox, switch on `environment: production` with required reviewers
  per §5.1 option B.
- **Image scanning.** Add an `aquasecurity/trivy-action` or
  `docker/scout` step after the build and fail on high/critical
  findings.
- **Read-only containers.** App containers serve static files; you can
  add `read_only: true` plus a `tmpfs:` for `/tmp` to harden them
  further.

---

## 12. Troubleshooting

| Symptom                                               | Likely cause                                                                                | Fix                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ACME challenge fails on first start                   | DNS doesn't yet point to the VM, or :80 is blocked.                                         | `dig +short v1.khrum-khrum.info`; verify NSG/UFW; retry. Use the staging CA while iterating.              |
| `denied: installation not allowed to Create organization package` on first push | First-ever push to GHCR creates the package; org may require explicit opt-in. | Settings → Packages → allow the workflow; re-run.                                                         |
| `502 Bad Gateway` from `v1.khrum-khrum.info`          | `app-v1` not running yet, or unhealthy.                                                     | `docker compose logs app-v1`; verify `IMAGE_V1` in `.env` exists in the registry.                         |
| Old image keeps serving after deploy                  | A long-lived browser tab is still on the previous JS bundle, or an HTTP cache was added.    | Vite emits hashed asset filenames so `dist/assets/*` is content-addressed. The only file that should not be aggressively cached is `index.html`. Hard-refresh; verify Caddy isn't caching `/`. |
| Smoke test fails but the site loads in a browser      | DNS lookup mismatch between runner and your client, or cert just-issued and not yet served. | Re-run after a minute; `curl -v https://v1.khrum-khrum.info/` from the runner.                            |
| SSH step hangs / times out                            | NSG blocks the runner's IP, or `SSH_KNOWN_HOSTS` doesn't match.                             | Re-run `ssh-keyscan -p 22 khrum-khrum.info` and update the secret in both repos; verify NSG inbound rule. |
| Caddy logs `too many certificates already issued`     | Hit Let's Encrypt's per-domain weekly rate limit during testing.                            | Switch to staging CA in the Caddyfile, wait out the limit (typically a week), then switch back.           |
| Deploy succeeded but the *other* app went down        | A bad `docker compose up -d` invocation restarted everything.                               | The workflow uses `--no-deps "app-${APP}"` to scope to one service. Don't drop the flag.                  |
| Apex `khrum-khrum.info` returns a cert warning        | DNS A record for apex is missing, or Caddy never issued its cert.                           | `dig +short khrum-khrum.info`; check `caddy list-certificates`; remove and re-add the apex site block to retrigger issuance. |
