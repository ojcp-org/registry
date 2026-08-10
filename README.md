# OJCP Registry

The provider registry for the [Open Job Context Protocol](https://ojcp.dev). One reviewed JSON
entry per provider, under [`providers/`](providers/). This repository **is** the registry: the
list is public, every change is a reviewed pull request, and the git history is the audit trail.

## What a listing means

A listing records *trust metadata* about an OJCP provider — not its job data (that stays on the
provider's own endpoint). Each entry carries a `trust_tier`:

| Tier | What it means |
|------|---------------|
| `unverified` | The manifest exists at `/.well-known/ojcp.json` and parses. Default on first listing. |
| `verified` | Manifest is signed **and** domain control is proven **and** employer identity was confirmed. |
| `audited` | `verified`, plus passes the [conformance suite](https://github.com/ojcp-org/conformance), a security review, and 90 days with no abuse reports. |

Tiers follow the [Registry Trust Tiers](https://spec.ojcp.dev/0.1/#trust-tiers) section of the spec.

## How to get listed

1. Serve a valid manifest at `https://<your-domain>/.well-known/ojcp.json`.
2. Open a PR adding `providers/<your-domain>.json` (see the schema in
   [`schema/registry-entry.schema.json`](schema/registry-entry.schema.json) and the
   [`providers/ojcp.dev.json`](providers/ojcp.dev.json) example). New listings start at
   `unverified`.
3. CI validates: schema, that the live manifest fetches and has the required fields, and — for any
   tier above `unverified` — that **domain control** is proven.

The [ojcp.dev registry page](https://ojcp.dev) can pre-fill this PR for you.

### Proving domain control (required above `unverified`)

Set `domain_control.method` to one of:

- **`signed_manifest`** — your manifest carries a valid `signature` verifiable against a key served
  at `https://<domain>/.well-known/ojcp-keys.json`. Reusing manifest signing means no extra step.
- **`dns_txt`** — publish a TXT record containing `ojcp-registry-verification=<token>` on the domain.

This is what stops anyone from listing a domain they don't control.

## Local checks

```bash
pnpm install
pnpm validate          # schema + live manifest + domain control
pnpm validate:offline  # schema only (no network)
pnpm build             # generate registry.json
```

## Consuming the registry

CI builds `providers/*.json` into a single `registry.json`. Agents and the `find_ojcp_providers`
tool read that index; they never depend on this repo's internal file layout.

## Governance

Listings and tier changes are decided by reviewed PR under the OJCP
[governance process](https://github.com/ojcp-org/ojcp/blob/main/GOVERNANCE.md). Per that document,
registry infrastructure is committed to transfer to a neutral foundation before v1.0 — because the
registry is a git repository, that transfer is a repository move, not a data migration.

The `attestations` field is a forward hook: today the registry is the sole trust issuer, but the
entry format is designed so independent issuers (ATS vendors, KYB providers, identity verifiers)
can attach signed attestations later, so trust is not permanently centralized in this repo.

## License

Apache-2.0.
