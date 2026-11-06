# Shared contact mail API

One image (`local/mail-api:latest`) runs as two independent Compose services:
`professional_mail_api` and `herborn_mail_api`. Both listen on internal port 8787
on the `web` network; neither publishes a host port. Nginx routes each site's
`/api/contact` to its service.

Each service mounts its instance directory read-only at `/app/config` and the
shared parent file at `/app/defaults.json`.
`CONFIG_DIR` selects this directory. Layout:

```text
config/
  defaults.json
  professional/
    config.json
    .env
  herborn/
    config.json
    .env
```

`defaults.json` contains shared defaults. Each instance's `config.json` only
contains overrides. Precedence: defaults.json → instance config.json → mapped
environment variables (the instance .env overrides process environment). Nested
objects merge; arrays and scalar values replace the parent value. Empty strings,
false, and zero are explicit overrides. Deleting an override restores inheritance.

Application settings include: listener and proxy settings, form field
names, limits, email templates, confirmation wording, and response messages.
`.env` contains SMTP settings and addresses: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM`, `CONTACT_FORM_RECEIVER`, and
`CONTACT_REPLY_TO`. Both instance env files contain the same keys. Private env files are excluded from Git; all instance config
is excluded from Docker builds. The shared application has no site selection or
site-specific templates. Compose and Nginx retain the infrastructure mapping
between domains, service names, and mounted directories.

Herborn uses the existing SMTP account and sender with its own recipient. CONTACT_REPLY_TO configures confirmation replies; empty means replies go to SMTP_FROM. Use a provider-authorized sender when changing SMTP_FROM.
For local use, set CONFIG_DIR to the desired instance directory. The parent
defaults.json is found automatically; CONFIG_DEFAULTS_FILE can override its path.

Additional configurable settings: app.healthPath, contact.confirmationEnabled,
contact.rateStandardHeaders, contact.rateLegacyHeaders, and SMTP defaults.
The rate limit remains 5 attempts per IP per 900000 ms (15 minutes).
Infrastructure settings (Docker networks, restart policies, healthcheck commands,
Nginx domains/TLS/timeouts, and deployment) remain in Compose, Nginx, and CI.
Changing listener ports or endpoint paths also requires matching infrastructure
changes. HTTP status codes and the JSON response/form contract remain application
code, not arbitrary configuration.

## Deploy code updates

From `/docker/mail_api`:

```sh
docker compose build professional_mail_api
docker compose up -d --no-build professional_mail_api herborn_mail_api
docker compose -f /docker/docker-compose.yml exec -T main_webserver nginx -t
docker compose -f /docker/docker-compose.yml exec -T main_webserver nginx -s reload
```

The local `docker-compose.yml` manages both instances under project `mail_api`.
The root `/docker/docker-compose.yml` manages the shared Nginx webserver.
The mail repository's GitHub workflow runs this process after pulling main.
The Nginx reload refreshes upstream addresses after container recreation.

## Change one site's configuration

For shared defaults changes, recreate both services. For instance-only changes,
edit its config.json or .env, then recreate that service to reread configuration and remount
the file (including after an editor replaces the file atomically):

```sh
docker compose up -d --no-build --force-recreate herborn_mail_api
docker compose -f /docker/docker-compose.yml exec -T main_webserver nginx -t
docker compose -f /docker/docker-compose.yml exec -T main_webserver nginx -s reload
```

The API trusts one reverse proxy hop; keep it behind Nginx without published
ports. Forms send JSON with name, email, message, optional service and website
(honeypot), and submittedAt (form opening timestamp in milliseconds).
Both sites use submittedAt. The deployed Herborn build was patched on this
server; its Astro source must also send submittedAt before the next deployment.
Health checks use http://127.0.0.1:8787/health and do not test SMTP delivery.

## Verify configuration and delivery behavior without sending email

From `/docker/mail_api`, after building the shared image:

```sh
docker compose run --rm --no-deps -T professional_mail_api node --input-type=module < tests/config-smoke.mjs
docker compose run --rm --no-deps -T herborn_mail_api node --input-type=module < tests/config-smoke.mjs
```
