import manifest from "../../../ml/prompts/manifest.json";
import { ML_CAPABILITIES, ML_REGISTRY, type MlCapability } from "@/lib/ml/registry";

export type PromptManifestEntry = {
  key: string;
  version: string;
  capability: string;
  sourceHint: string;
};

export function listPromptManifestEntries(): PromptManifestEntry[] {
  return manifest.prompts as PromptManifestEntry[];
}

/** Falha se o registo ML e o manifest divergirem (release gate). */
export function validatePromptManifestAgainstRegistry(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const byCapability = new Map(listPromptManifestEntries().map((entry) => [entry.capability, entry]));

  for (const capability of ML_CAPABILITIES) {
    const def = ML_REGISTRY[capability];
    const entry = byCapability.get(capability);
    if (!entry) {
      errors.push(`manifest_missing:${capability}`);
      continue;
    }
    if (entry.key !== def.promptKey) {
      errors.push(`prompt_key_mismatch:${capability}`);
    }
    if (entry.version !== def.promptVersion) {
      errors.push(`prompt_version_mismatch:${capability}:${entry.version}!=${def.promptVersion}`);
    }
  }

  for (const entry of listPromptManifestEntries()) {
    if (!ML_CAPABILITIES.includes(entry.capability as MlCapability)) {
      errors.push(`unknown_capability_in_manifest:${entry.capability}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
