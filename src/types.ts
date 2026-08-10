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

export interface RegistryIndex {
  ojcp_registry_version: string;
  generated_from: string;
  count: number;
  providers: RegistryEntry[];
}
