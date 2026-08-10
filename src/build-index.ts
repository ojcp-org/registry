// Builds providers/*.json into a single registry.json that the website /
// find_ojcp_providers reads. Run in CI after validate passes; publish registry.json.
// Usage: tsx src/build-index.ts

import chalk from "chalk";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryEntry, RegistryIndex } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PROVIDERS = resolve(ROOT, "providers");

const providers: RegistryEntry[] = readdirSync(PROVIDERS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(resolve(PROVIDERS, f), "utf8")) as RegistryEntry)
  .sort((a, b) => a.name.localeCompare(b.name));

const index: RegistryIndex = {
  ojcp_registry_version: "0.1",
  generated_from: "providers/*.json",
  count: providers.length,
  providers,
};

writeFileSync(resolve(ROOT, "registry.json"), JSON.stringify(index, null, 2) + "\n");
console.log(chalk.green(`✓ built registry.json (${providers.length} providers)`));
