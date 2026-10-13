export type TrustTier = "unverified" | "verified" | "audited";

export interface Attestation {
  issuer: string;
  type: string;
  evidence_url?: string;
  issued_at?: string;
}

export interface TierChange {
  tier: TrustTier;
  date: string;
  note?: string;
}

export interface DomainControl {
  method: "signed_manifest" | "dns_txt";
  verified_at?: string;
}

export interface RegistryEntry {
  domain: string;
  name: string;
  manifest_url: string;
  trust_tier: TrustTier;
  manifest_signed?: boolean;
  domain_control?: DomainControl;
  industries?: string[];
  has_agent_apply?: boolean;
  attestations?: Attestation[];
  added_at: string;
  tier_history?: TierChange[];
}

export interface ManifestSnapshot {
  ojcp_version: string;
  name: string;
  description?: string;
  mcp_endpoint?: string;
  tools: string[];
  apply_paths: string[];
  auth_required: boolean;
  signed: boolean;
}

export interface ConformanceCheck {
  test: string;
  status: "passed" | "failed" | "skipped";
  message?: string;
}

export interface ConformanceSummary {
  suite_version: string;
  passed: number;
  failed: number;
  skipped: number;
  results: ConformanceCheck[];
}

/** Live evidence gathered when the index is built; absent in offline builds. */
export interface ProviderHealth {
  checked_at: string;
  manifest: ManifestSnapshot | null;
  manifest_error?: string;
  conformance: ConformanceSummary | null;
}

export interface IndexedProvider extends RegistryEntry {
  health?: ProviderHealth;
}

export interface RegistryIndex {
  ojcp_registry_version: string;
  generated_at: string;
  count: number;
  providers: IndexedProvider[];
}
