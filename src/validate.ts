// Validates every providers/*.json entry:
//   1. filename matches the entry's `domain`
//   2. entry conforms to schema/registry-entry.schema.json
//   3. manifest_url is https://<domain>/.well-known/ojcp.json
//   4. the live manifest fetches, parses, and has required OJCP fields
//   5. domain control is proven (signed_manifest or dns_txt) for any tier above 'unverified'
//
// Exit non-zero on any failure so CI blocks the PR.
// Usage: tsx src/validate.ts [--offline]   (--offline skips network checks)

import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import chalk from "chalk";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promises as dns } from "node:dns";
import type { RegistryEntry } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PROVIDERS = resolve(ROOT, "providers");
const OFFLINE = process.argv.includes("--offline");
const FETCH_TIMEOUT_MS = 15_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(addFormats as any)(ajv);
const validateEntry: ValidateFunction = ajv.compile(
  JSON.parse(readFileSync(resolve(ROOT, "schema/registry-entry.schema.json"), "utf8")),
);

const errors: string[] = [];
const fail = (file: string, msg: string): void => {
  errors.push(`${file}: ${msg}`);
};

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "error" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(t);
  }
}

const files = readdirSync(PROVIDERS).filter((f) => f.endsWith(".json"));
if (files.length === 0) fail("providers/", "no entries found");

for (const file of files) {
  const path = resolve(PROVIDERS, file);
  let entry: RegistryEntry;
  try {
    entry = JSON.parse(readFileSync(path, "utf8")) as RegistryEntry;
  } catch (e) {
    fail(file, `invalid JSON: ${(e as Error).message}`);
    continue;
  }

  // 1. filename ↔ domain
  if (basename(file, ".json") !== entry.domain) {
    fail(file, `filename must match domain "${entry.domain}"`);
  }

  // 2. schema
  if (!validateEntry(entry)) {
    for (const e of validateEntry.errors ?? []) {
      fail(file, `schema ${e.instancePath || "/"} ${e.message}`);
    }
    continue;
  }

  // 3. manifest_url shape
  const expected = `https://${entry.domain}/.well-known/ojcp.json`;
  if (entry.manifest_url !== expected) {
    fail(file, `manifest_url must be ${expected}`);
  }

  if (OFFLINE) continue;

  // 4. live manifest
  let manifest: Record<string, unknown>;
  try {
    manifest = await fetchJson(entry.manifest_url);
  } catch (e) {
    fail(file, `manifest unreachable (${(e as Error).message})`);
    continue;
  }
  const provider = manifest.provider as { name?: string } | undefined;
  if (!manifest.ojcp_version || !provider?.name || !Array.isArray(manifest.tools)) {
    fail(file, "manifest missing ojcp_version, provider.name, or tools");
  }

  // 5. domain control — REQUIRED for any tier above 'unverified'
  if (entry.trust_tier !== "unverified") {
    const dc = entry.domain_control;
    if (!dc) {
      fail(file, `trust_tier "${entry.trust_tier}" requires a domain_control proof`);
    } else if (dc.method === "signed_manifest") {
      if (!manifest.signature) {
        fail(file, "domain_control=signed_manifest but manifest has no signature");
      }
      // Full JWS verification against /.well-known/ojcp-keys.json is performed by the
      // reviewer / conformance suite; here we assert the signature is present.
    } else if (dc.method === "dns_txt") {
      try {
        const txt = (await dns.resolveTxt(entry.domain)).flat().join(" ");
        if (!/ojcp-registry-verification=/.test(txt)) {
          fail(file, "domain_control=dns_txt but no ojcp-registry-verification TXT record found");
        }
      } catch {
        fail(file, "domain_control=dns_txt but TXT lookup failed");
      }
    }
  }
}

if (errors.length) {
  console.error(chalk.red(`\n✘ ${errors.length} validation error(s):\n`));
  for (const e of errors) console.error(chalk.red("  - " + e));
  process.exit(1);
}
console.log(chalk.green(`✓ ${files.length} registry entr${files.length === 1 ? "y" : "ies"} valid`));
