// Builds providers/*.json into a single registry.json that the website and
// find_ojcp_providers read. With --health, each provider also gets live
// evidence: a manifest snapshot and a conformance run (see health.ts).
// Usage: tsx src/build-index.ts [--health] [--out <path>]

import chalk from "chalk";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkProvider } from "./health.ts";
import type { IndexedProvider, RegistryEntry, RegistryIndex } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PROVIDERS = resolve(ROOT, "providers");
const WITH_HEALTH = process.argv.includes("--health");
const outFlag = process.argv.indexOf("--out");
const OUT = resolve(
  ROOT,
  outFlag >= 0 ? process.argv[outFlag + 1] : "registry.json",
);

const entries: RegistryEntry[] = readdirSync(PROVIDERS)
  .filter((f) => f.endsWith(".json"))
  .map(
    (f) =>
      JSON.parse(readFileSync(resolve(PROVIDERS, f), "utf8")) as RegistryEntry,
  )
  .sort((a, b) => a.name.localeCompare(b.name));

const providers: IndexedProvider[] = [];
for (const entry of entries) {
  if (!WITH_HEALTH) {
    providers.push(entry);
    continue;
  }
  const health = await checkProvider(entry);
  const summary = health.conformance
    ? `${health.conformance.passed}/${health.conformance.passed + health.conformance.failed} checks`
    : (health.manifest_error ?? "conformance not run");
  console.log(
    `${health.manifest ? chalk.green("✓") : chalk.yellow("!")} ${entry.domain}: ${summary}`,
  );
  providers.push({ ...entry, health });
}

const index: RegistryIndex = {
  ojcp_registry_version: "0.2",
  generated_at: new Date().toISOString(),
  count: providers.length,
  providers,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(index, null, 2) + "\n");
console.log(
  chalk.green(
    `✓ built ${OUT} (${providers.length} providers${WITH_HEALTH ? ", with health" : ""})`,
  ),
);
