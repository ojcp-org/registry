// Gathers live evidence for one listed provider: a snapshot of its manifest and
// a run of the OJCP conformance suite. Failures are recorded, never thrown, so
// one unreachable provider can't stop the index from publishing.

import {
  CONFORMANCE_VERSION,
  runConformanceSuite,
  type TestResult,
} from "@ojcp/conformance";
import type {
  ConformanceSummary,
  ManifestSnapshot,
  ProviderHealth,
  RegistryEntry,
} from "./types.ts";
import { setTimeout as sleep } from "node:timers/promises";

const FETCH_TIMEOUT_MS = 15_000;
const MESSAGE_LIMIT = 300;
const RETRY_DELAY_MS = 5_000;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "TimeoutError"
      ? `timed out after ${FETCH_TIMEOUT_MS / 1000}s`
      : error.message;
  }
  return String(error);
}

async function fetchManifestOnce(url: string): Promise<UnknownRecord> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "error",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = asRecord(await res.json());
  if (!body) throw new Error("manifest is not a JSON object");
  return body;
}

// One retry: a nightly snapshot shouldn't mark a provider unreachable for a
// day because of a single dropped connection.
async function fetchManifest(url: string): Promise<UnknownRecord> {
  try {
    return await fetchManifestOnce(url);
  } catch {
    await sleep(RETRY_DELAY_MS);
    return fetchManifestOnce(url);
  }
}

function snapshot(manifest: UnknownRecord): ManifestSnapshot {
  const provider = asRecord(manifest.provider);
  const description = asString(provider?.description);
  const mcpEndpoint = asString(manifest.mcp_endpoint);
  return {
    ojcp_version: asString(manifest.ojcp_version) ?? "unknown",
    name: asString(provider?.name) ?? "unknown",
    ...(description ? { description } : {}),
    ...(mcpEndpoint ? { mcp_endpoint: mcpEndpoint } : {}),
    tools: asStrings(manifest.tools),
    apply_paths: asStrings(manifest.apply_paths),
    auth_required: asRecord(manifest.auth)?.required === true,
    signed: asRecord(manifest.signature) !== undefined,
  };
}

// A failed schema check reports its detail in `errors`, not `message`.
function describeResult(result: TestResult): string | undefined {
  const details = (result.errors ?? []).map(
    (error) => `${error.instancePath || "/"}: ${error.message}`,
  );
  const text = [result.message, ...new Set(details)].filter(Boolean).join("; ");
  return text ? text.slice(0, MESSAGE_LIMIT) : undefined;
}

async function conformance(domain: string): Promise<ConformanceSummary | null> {
  try {
    const report = await runConformanceSuite(`https://${domain}`);
    return {
      suite_version: CONFORMANCE_VERSION,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      results: report.results.map((result) => {
        const message = describeResult(result);
        return {
          test: result.test,
          status: result.status,
          ...(message ? { message } : {}),
        };
      }),
    };
  } catch {
    return null;
  }
}

export async function checkProvider(
  entry: RegistryEntry,
): Promise<ProviderHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const manifest = snapshot(await fetchManifest(entry.manifest_url));
    return {
      checked_at: checkedAt,
      manifest,
      conformance: await conformance(entry.domain),
    };
  } catch (error) {
    return {
      checked_at: checkedAt,
      manifest: null,
      manifest_error: errorMessage(error).slice(0, MESSAGE_LIMIT),
      conformance: null,
    };
  }
}
