#!/usr/bin/env node
/** Checklist R2/R4 antes de `terraform apply` staging. */
import fs from "node:fs";

const checks = [];

function pass(name, ok, detail) {
  checks.push({ name, ok, detail });
}

pass("terraform/main.tf", fs.existsSync("infra/terraform/main.tf"), "RDS + S3");
pass("kms.tf", fs.existsSync("infra/terraform/kms.tf"), "KMS CMK");
pass("secrets.tf", fs.existsSync("infra/terraform/secrets.tf"), "Secrets Manager");
pass("staging.tfvars", fs.existsSync("infra/terraform/environments/staging.tfvars"), "enable_redis");
pass("STAGING_KMS.md", fs.existsSync("docs/STAGING_KMS.md"), "runbook");
pass("terraform plan workflow", fs.existsSync(".github/workflows/terraform-staging-plan.yml"), "CI plan");

let failed = 0;
for (const c of checks) {
  console.log(`[${c.ok ? "OK" : "FALTA"}] ${c.name} — ${c.detail}`);
  if (!c.ok) failed += 1;
}

if (failed === 0) {
  console.log("\nPróximo passo operacional:");
  console.log("  terraform -chdir=infra/terraform init");
  console.log("  terraform -chdir=infra/terraform apply -var-file=environments/staging.tfvars");
}

process.exit(failed > 0 ? 1 : 0);
