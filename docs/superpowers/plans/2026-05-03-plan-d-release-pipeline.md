# Vox Era — Plan D: Release Pipeline & Distribution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision AWS infrastructure via Pulumi (S3 + CloudFront + ACM + IAM/OIDC role) plus Cloudflare DNS records (zone + ACM validation + apex/www CNAMEs), wire up the full release pipeline (Apple notarization + GPG-signed deb/rpm + apt/dnf repos + minisign-signed Tauri auto-update manifest + landing deploy), implement the `/release` slash command, ship a first signed test release `v0.1.0-alpha` validating end-to-end, then complete Phase 4 cleanup (delete `legacy/electron/`, finalize all docs, merge `execution` to `main`).

**Architecture:** GitHub Actions tag-triggered workflow on `v*` tags. Three platform build jobs (macOS DMG signed+notarized via Apple Developer ID, Windows NSIS unsigned, Linux AppImage+deb+rpm GPG-signed). Aggregation job generates `latest.json` (minisign-signed) + apt repo (`aptly` + GPG-signed metadata) + dnf repo (`createrepo_c` + GPG-signed metadata), syncs to S3, invalidates CloudFront. Production landing deploy in same workflow. Manual prerequisites: GPG keypair, minisign keypair, Apple cert + notarization key, AWS infra.

**Tech Stack:** GitHub Actions, Apple `notarytool`, minisign (`tauri signer`), GPG, `aptly`, `createrepo_c`, AWS S3 + CloudFront + ACM + IAM/OIDC, Cloudflare DNS, Pulumi (TypeScript) for IaC managed by **Pulumi Cloud** under personal account `guilherme-vozniak-a-gmail-com` (state + secrets handled server-side; no S3/KMS bootstrap), Tauri's bundling pipeline. AWS profile: `voxera`.

**Depends on:** Plans A (monorepo + base CI), B (desktop app to release), C (landing to deploy production-ready).
**Blocks:** Nothing — Plan D is the final plan.

---

## Section 1: Manual prerequisites — keys, certs, accounts, infra bootstrap

These tasks involve human-only setup steps. Each task documents the exact commands; credentials are set via the `gh secret set` CLI rather than the GitHub web UI. AWS commands all run with `--profile voxera` so they target the right AWS account. Pulumi state and secrets are managed by Pulumi Cloud under the personal account `guilherme-vozniak-a-gmail-com` — no S3 state bucket, no AWS KMS key, no chicken-and-egg bootstrap.

**Pre-flight (once, before Section 1):**

```bash
gh --version && gh auth status
aws --profile voxera sts get-caller-identity
bunx pulumi version || bun add -g pulumi
```

Expected:
- `gh` installed and authenticated to github.com (run `gh auth login` if not)
- `aws --profile voxera sts get-caller-identity` returns the right AWS account (configure with `aws configure --profile voxera` if not)
- Pulumi CLI installed (install via `bun add -g pulumi` or `curl -fsSL https://get.pulumi.com | sh` if missing)

### Task 1: Generate the GPG keypair for Linux package signing

**Files:** none (output paste-targets are GitHub Secrets)

**Steps:**

- [ ] **Step 1: Generate the keypair**

Run:
```bash
gpg --full-generate-key
```

When prompted:
- Key kind: `(1) RSA and RSA`
- Keysize: `4096`
- Validity: `0` (does not expire)
- Real name: `Vox Era Releases`
- Email: `releases@vox-era.com` (or any address you control)
- Comment: leave blank
- Passphrase: pick a strong one and store it in your password manager

- [ ] **Step 2: Set the private key + passphrase as GitHub Secrets via `gh secret set`**

Run:
```bash
gpg --export-secret-keys --armor "Vox Era Releases" | gh secret set GPG_PRIVATE_KEY --repo programow/vox-era
read -s -p "GPG passphrase: " GPG_PASS && echo && gh secret set GPG_PASSPHRASE --body "$GPG_PASS" --repo programow/vox-era && unset GPG_PASS
```
Expected: `✓ Set secret GPG_PRIVATE_KEY for programow/vox-era` and `✓ Set secret GPG_PASSPHRASE for programow/vox-era`.

Verify:
```bash
gh secret list --repo programow/vox-era | grep -E 'GPG_PRIVATE_KEY|GPG_PASSPHRASE'
```
Expected: both secrets listed.

- [ ] **Step 3: (no separate step needed — Step 2 sets both secrets)**

- [ ] **Step 4: Export the public key for users**

Run:
```bash
gpg --export --armor "Vox Era Releases" > vox-era-releases.gpg
```

Keep this file in your password manager too. CI uploads a copy to S3 at `s3://vox-era-prod/keys/vox-era-releases.gpg` as part of the release workflow.

- [ ] **Step 5: Backup the private key**

Save the same `gpg --export-secret-keys --armor "Vox Era Releases" > vox-era-private.asc` output into your password manager. If you lose it, you can't sign new releases without breaking trust for existing users.

---

### Task 2: Generate the Tauri minisign updater keypair

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json` (replace placeholder pubkey)

**Steps:**

- [ ] **Step 1: Generate the keypair**

Run:
```bash
bunx @tauri-apps/cli signer generate -w ~/.tauri/voxera_updater.key
```

When prompted, set a passphrase (different from the GPG one). Outputs:
- Private key: `~/.tauri/voxera_updater.key`
- Public key: printed to stdout

- [ ] **Step 2: Embed the public key in `tauri.conf.json`**

Replace the placeholder `"REPLACE_WITH_MINISIGN_PUBKEY_FROM_PLAN_D"` in `packages/desktop/src-tauri/tauri.conf.json` `plugins.updater.pubkey` with the public key from Step 1.

- [ ] **Step 3: Set the private key + passphrase as GitHub Secrets via `gh secret set`**

```bash
gh secret set TAURI_UPDATER_PRIVATE_KEY --repo programow/vox-era < ~/.tauri/voxera_updater.key
read -s -p "Tauri updater passphrase: " TAURI_PASS && echo && gh secret set TAURI_UPDATER_PASSPHRASE --body "$TAURI_PASS" --repo programow/vox-era && unset TAURI_PASS
```
Expected: both secrets set successfully.

- [ ] **Step 4: Backup**

Save the private key to your password manager. Document key rotation policy in `docs/build-and-release.md` (Task 18).

- [ ] **Step 5: Commit the public-key edit**

```bash
git add packages/desktop/src-tauri/tauri.conf.json
git commit -m "chore(desktop): embed Tauri updater minisign public key"
```

---

### Task 3: Apple Developer ID cert + notarization API key

**Files:** none (paste-targets are GitHub Secrets)

**Steps:**

- [ ] **Step 1: Export the Developer ID Application certificate as `.p12`**

From your Mac:

```bash
# 1. Open Keychain Access → login keychain → Certificates
# 2. Right-click your "Developer ID Application: <name>" cert + private key → Export 2 items…
# 3. Save as DeveloperIDApplication.p12 with a strong export password
```

- [ ] **Step 2: Base64-encode and set as GitHub Secrets via `gh secret set`**

```bash
base64 -i DeveloperIDApplication.p12 | gh secret set APPLE_DEVELOPER_ID_CERT --repo programow/vox-era
read -s -p "Developer ID export password: " APPLE_PASS && echo && gh secret set APPLE_DEVELOPER_ID_PASSWORD --body "$APPLE_PASS" --repo programow/vox-era && unset APPLE_PASS
```

- [ ] **Step 3: Create the App Store Connect API key for notarization**

Visit https://appstoreconnect.apple.com/access/api. Create a new key:
- Access: "Developer" role is sufficient
- Download the `.p8` file. Note the Key ID and Issuer UUID shown on the page.

- [ ] **Step 4: Base64-encode the .p8 and set all three Apple API secrets via `gh secret set`**

Replace `<KEY_ID>` with your actual Key ID and `<ISSUER_UUID>` with the Issuer UUID from the App Store Connect API page:

```bash
base64 -i AuthKey_<KEY_ID>.p8 | gh secret set APPLE_API_KEY_CONTENT --repo programow/vox-era
gh secret set APPLE_API_KEY_ID --body "<KEY_ID>" --repo programow/vox-era
gh secret set APPLE_API_KEY_ISSUER --body "<ISSUER_UUID>" --repo programow/vox-era
```

- [ ] **Step 5: Backup the .p8**

Apple lets you download a key only once. Save it to your password manager.

---

### Task 4: Pulumi Cloud login + Cloudflare API token

Pulumi Cloud manages state and secrets server-side under the maintainer's personal account `guilherme-vozniak-a-gmail-com`. No S3 bucket, no AWS KMS key, no chicken-and-egg bootstrap. Authentication happens via the Pulumi CLI (`pulumi login`) for local development and a long-lived `PULUMI_ACCESS_TOKEN` for CI.

**Files:** none (manual environment setup)

**Steps:**

- [ ] **Step 1: Login to Pulumi Cloud and create a CI access token**

If the local Pulumi CLI isn't already authenticated, run:

```bash
pulumi login
```
This opens a browser to https://app.pulumi.com to confirm. The CLI now uses the personal account `guilherme-vozniak-a-gmail-com` as the default backend (`PULUMI_BACKEND_URL` is unset, which is what we want).

Then, for CI, mint a long-lived token at https://app.pulumi.com/account/tokens:
- Description: `vox-era-ci`
- Expiration: 1 year (rotate annually; calendar reminder)

Copy the token (shown once). It is pushed to GitHub Secrets in Task 5 Step 8.

- [ ] **Step 2: Generate a Cloudflare API token**

Manual UI step (one-time): go to https://dash.cloudflare.com/profile/api-tokens → "Create Token" → "Custom token". Permissions:
- Zone → Zone → Read
- Zone → DNS → Edit

Zone resources: include the specific zone for `vox-era.com`.

Copy the generated token (shown once).

Get your Cloudflare zone id from the Cloudflare dashboard → your domain → right sidebar → "Zone ID".

Keep both values; Task 5 stores them in Pulumi stack config (Pulumi-encrypted secrets).

- [ ] **Step 3: Commit (no files changed; this task is environment setup)**

Nothing to commit. Move to Task 5.

---

### Task 5: Pulumi `packages/infra` — scaffold, define resources, apply, capture outputs

Defines all AWS infrastructure (S3 site bucket, IAM/OIDC role, ACM cert, CloudFront distribution) plus Cloudflare DNS records (zone records + ACM validation records) in TypeScript. Runs `pulumi up` to provision. Captures the resulting ARNs/IDs and pushes them to GitHub Secrets so the release workflow can use them.

**Files:**
- Create: `packages/infra/Pulumi.yaml`
- Create: `packages/infra/Pulumi.prod.yaml`
- Create: `packages/infra/index.ts`
- Create: `packages/infra/package.json` (replace placeholder from Plan A)
- Create: `packages/infra/tsconfig.json`
- Create: `packages/infra/README.md`

**Steps:**

- [ ] **Step 1: Replace `packages/infra/package.json` with real deps**

```json
{
  "name": "@vox-era/infra",
  "private": true,
  "version": "0.0.0",
  "description": "Vox Era infrastructure as code (Pulumi + AWS + Cloudflare DNS)",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "preview": "pulumi preview --stack prod",
    "up": "pulumi up --stack prod",
    "refresh": "pulumi refresh --stack prod",
    "outputs": "pulumi stack output --stack prod --json",
    "test": "echo 'no tests for IaC' && exit 0",
    "test:unit": "echo 'no tests for IaC' && exit 0",
    "test:integration": "echo 'no tests for IaC' && exit 0"
  },
  "dependencies": {
    "@pulumi/aws": "^6.50.0",
    "@pulumi/cloudflare": "^5.30.0",
    "@pulumi/pulumi": "^3.130.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.5.0"
  }
}
```

Run: `bun install`
Expected: deps resolve.

- [ ] **Step 2: Create `packages/infra/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "bin",
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["index.ts"],
  "exclude": ["node_modules", "bin"]
}
```

- [ ] **Step 3: Create `packages/infra/Pulumi.yaml` (project metadata)**

```yaml
name: vox-era-infra
runtime: nodejs
description: Vox Era infrastructure (AWS S3, CloudFront, ACM, IAM/OIDC + Cloudflare DNS)
```

No `backend:` block — Pulumi Cloud is the default backend when the CLI is logged in to `app.pulumi.com`.

- [ ] **Step 4: Create the stack on Pulumi Cloud**

```bash
cd packages/infra
pulumi stack init guilherme-vozniak-a-gmail-com/prod
```
Expected: stack `guilherme-vozniak-a-gmail-com/vox-era-infra/prod` created on Pulumi Cloud. The state and secrets will live there. No `--secrets-provider` flag needed; Pulumi Cloud uses its built-in secrets manager by default.

- [ ] **Step 5: Set Pulumi stack config (Cloudflare zone id + token, encrypted by Pulumi Cloud)**

```bash
cd packages/infra
pulumi config set --stack prod domain vox-era.com
pulumi config set --stack prod githubRepo programow/vox-era
pulumi config set --stack prod cloudflareZoneId <PASTE_ZONE_ID_FROM_TASK_4_STEP_2>
pulumi config set --stack prod --secret cloudflareApiToken <PASTE_TOKEN_FROM_TASK_4_STEP_2>
```
Expected: `Pulumi.prod.yaml` is updated; the API token is encrypted (shown as `secure: "..."` in the YAML — Pulumi Cloud holds the decryption key).

- [ ] **Step 6: Create `packages/infra/index.ts` defining all resources**

```ts
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as cloudflare from '@pulumi/cloudflare';

const config = new pulumi.Config();
const domain = config.require('domain');
const githubRepo = config.require('githubRepo');
const cloudflareZoneId = config.require('cloudflareZoneId');
const cloudflareApiToken = config.requireSecret('cloudflareApiToken');

const awsProvider = new aws.Provider('voxera', {
    profile: 'voxera',
    region: 'us-east-1',
});

const cfProvider = new cloudflare.Provider('voxera-cf', {
    apiToken: cloudflareApiToken,
});

// 1. Public S3 bucket for the static site + apt/dnf repos + update manifest.
const bucket = new aws.s3.BucketV2('vox-era-prod', { bucket: 'vox-era-prod' }, { provider: awsProvider });

const bucketAccess = new aws.s3.BucketPublicAccessBlock('vox-era-prod-public-access', {
    bucket: bucket.id,
    blockPublicAcls: false,
    ignorePublicAcls: false,
    blockPublicPolicy: false,
    restrictPublicBuckets: false,
}, { provider: awsProvider });

const bucketPolicy = new aws.s3.BucketPolicy('vox-era-prod-policy', {
    bucket: bucket.id,
    policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [{
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: pulumi.interpolate`${bucket.arn}/*`,
        }],
    }),
}, { provider: awsProvider, dependsOn: [bucketAccess] });

// 2. IAM OIDC provider + role for GitHub Actions to deploy via OIDC.
const githubOidc = new aws.iam.OpenIdConnectProvider('github-actions', {
    url: 'https://token.actions.githubusercontent.com',
    clientIdLists: ['sts.amazonaws.com'],
    thumbprintLists: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
}, { provider: awsProvider });

const ciRole = new aws.iam.Role('vox-era-ci', {
    name: 'vox-era-ci',
    assumeRolePolicy: githubOidc.arn.apply(arn => JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
            Effect: 'Allow',
            Principal: { Federated: arn },
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
                StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
                StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:*` },
            },
        }],
    })),
}, { provider: awsProvider });

const ciRolePolicy = new aws.iam.RolePolicy('vox-era-ci-deploy', {
    role: ciRole.id,
    policy: pulumi.jsonStringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Action: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject', 's3:ListBucket'],
                Resource: [bucket.arn, pulumi.interpolate`${bucket.arn}/*`],
            },
            { Effect: 'Allow', Action: ['cloudfront:CreateInvalidation'], Resource: '*' },
        ],
    }),
}, { provider: awsProvider });

// 3. ACM cert (DNS-validated via Cloudflare records).
const cert = new aws.acm.Certificate('vox-era', {
    domainName: domain,
    subjectAlternativeNames: [`www.${domain}`],
    validationMethod: 'DNS',
}, { provider: awsProvider });

const validationRecords = cert.domainValidationOptions.apply(opts =>
    opts.map((opt, i) => new cloudflare.Record(`acm-validation-${i}`, {
        zoneId: cloudflareZoneId,
        name: opt.resourceRecordName!,
        type: opt.resourceRecordType!,
        content: opt.resourceRecordValue!,
        ttl: 60,
        proxied: false,
    }, { provider: cfProvider })),
);

const certValidation = new aws.acm.CertificateValidation('vox-era', {
    certificateArn: cert.arn,
    validationRecordFqdns: validationRecords.apply(rs => rs.map(r => r.hostname)),
}, { provider: awsProvider });

// 4. CloudFront distribution.
const distribution = new aws.cloudfront.Distribution('vox-era', {
    enabled: true,
    isIpv6Enabled: true,
    aliases: [domain, `www.${domain}`],
    defaultRootObject: 'index.html',
    origins: [{
        domainName: bucket.bucketRegionalDomainName,
        originId: 's3-origin',
    }],
    defaultCacheBehavior: {
        targetOriginId: 's3-origin',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        forwardedValues: { queryString: false, cookies: { forward: 'none' } },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
        compress: true,
    },
    restrictions: { geoRestriction: { restrictionType: 'none' } },
    viewerCertificate: {
        acmCertificateArn: certValidation.certificateArn,
        sslSupportMethod: 'sni-only',
        minimumProtocolVersion: 'TLSv1.2_2021',
    },
}, { provider: awsProvider });

// 5. Cloudflare DNS apex + www → CloudFront (DNS-only / gray cloud).
new cloudflare.Record('apex', {
    zoneId: cloudflareZoneId,
    name: domain,
    type: 'CNAME',
    content: distribution.domainName,
    ttl: 1,
    proxied: false,
}, { provider: cfProvider });

new cloudflare.Record('www', {
    zoneId: cloudflareZoneId,
    name: `www.${domain}`,
    type: 'CNAME',
    content: distribution.domainName,
    ttl: 1,
    proxied: false,
}, { provider: cfProvider });

// Outputs (consumed by the release workflow via gh secret set).
export const bucketName = bucket.bucket;
export const distributionId = distribution.id;
export const distributionDomain = distribution.domainName;
export const ciRoleArn = ciRole.arn;
export const certificateArn = certValidation.certificateArn;
```

- [ ] **Step 7: Preview, then apply**

```bash
cd packages/infra
AWS_PROFILE=voxera pulumi preview --stack prod
```
Expected: a plan showing all the above resources to be created. Review carefully.

Then:
```bash
AWS_PROFILE=voxera pulumi up --stack prod
```
Expected: confirmation prompt; type `yes`. Resources are created. ACM cert validation may take ~5 minutes (Cloudflare DNS records propagate fast, Pulumi waits for cert state `ISSUED`). CloudFront distribution takes ~10–20 minutes to fully deploy.

- [ ] **Step 8: Capture outputs and push to GitHub Secrets via `gh secret set`**

```bash
cd packages/infra
ROLE_ARN=$(AWS_PROFILE=voxera pulumi stack output ciRoleArn --stack prod)
DIST_ID=$(AWS_PROFILE=voxera pulumi stack output distributionId --stack prod)

gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" --repo programow/vox-era
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "$DIST_ID" --repo programow/vox-era
```
Expected: both secrets set successfully.

Verify:
```bash
gh secret list --repo programow/vox-era | grep -E 'AWS_DEPLOY_ROLE_ARN|CLOUDFRONT_DISTRIBUTION_ID'
```
Expected: both listed.

- [ ] **Step 9: Create `packages/infra/README.md`**

```markdown
# @vox-era/infra

Pulumi infrastructure-as-code for Vox Era. Manages AWS (S3, IAM, ACM, CloudFront) and Cloudflare DNS (zone records + ACM validation).

## Stack: `prod`

State backend: Pulumi Cloud (personal account `guilherme-vozniak-a-gmail-com`, stack `guilherme-vozniak-a-gmail-com/vox-era-infra/prod`).
Secrets provider: Pulumi Cloud (built-in, server-side encryption).
AWS profile (for the AWS provider in resources, not for state): `voxera`.

## Day-to-day

```bash
# preview a change before applying
AWS_PROFILE=voxera bun run preview

# apply changes
AWS_PROFILE=voxera bun run up

# detect drift
AWS_PROFILE=voxera bun run refresh

# read outputs
AWS_PROFILE=voxera bun run outputs
```

## Secrets in stack config

- `cloudflareApiToken` (encrypted by Pulumi Cloud): scoped Zone:Read + DNS:Edit token for `vox-era.com`. Generate at https://dash.cloudflare.com/profile/api-tokens, then `pulumi config set --secret cloudflareApiToken <token>`.

## Outputs published to GitHub Secrets

The release workflow consumes these via `${{ secrets.NAME }}`:
- `AWS_DEPLOY_ROLE_ARN` ← `pulumi stack output ciRoleArn`
- `CLOUDFRONT_DISTRIBUTION_ID` ← `pulumi stack output distributionId`
- `PULUMI_ACCESS_TOKEN` ← https://app.pulumi.com/account/tokens (Plan D Task 4 Step 1)

Refresh after every `pulumi up` if outputs change:

```bash
ROLE_ARN=$(AWS_PROFILE=voxera pulumi stack output ciRoleArn --stack prod)
DIST_ID=$(AWS_PROFILE=voxera pulumi stack output distributionId --stack prod)
gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" --repo programow/vox-era
gh secret set CLOUDFRONT_DISTRIBUTION_ID --body "$DIST_ID" --repo programow/vox-era
```

## Bootstrap (one-time, before this package can run)

Log in to Pulumi Cloud (`pulumi login`) and generate a CI access token; create a Cloudflare API token. Both steps are documented in Plan D Task 4.
```

- [ ] **Step 10: Commit**

```bash
git add packages/infra/
git commit -m "feat(infra): scaffold Pulumi IaC for AWS + Cloudflare; first apply provisions S3, IAM/OIDC, ACM, CloudFront, DNS"
```

---

## Section 2: Release workflow YAML

### Task 6: macOS build job (signed + notarized + stapled)

**Files:**
- Create: `.github/workflows/release.yml` (skeleton)

**Steps:**

- [ ] **Step 1: Create the workflow skeleton with the macOS job**

```yaml
name: Release

on:
  push:
    tags: ["v*"]

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  id-token: write

jobs:
  build-macos:
    name: Build macOS DMG (signed + notarized)
    runs-on: macos-latest
    strategy:
      matrix:
        target: [x86_64-apple-darwin, aarch64-apple-darwin]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      - name: Install deps
        run: bun install --frozen-lockfile

      - name: Import Apple Developer ID cert
        env:
          CERT: ${{ secrets.APPLE_DEVELOPER_ID_CERT }}
          PASS: ${{ secrets.APPLE_DEVELOPER_ID_PASSWORD }}
        run: |
          echo "$CERT" | base64 --decode > /tmp/cert.p12
          security create-keychain -p ci-pass build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p ci-pass build.keychain
          security import /tmp/cert.p12 -k build.keychain -P "$PASS" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k ci-pass build.keychain
          rm /tmp/cert.p12

      - name: Set up notarization API key
        env:
          KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          KEY_CONTENT: ${{ secrets.APPLE_API_KEY_CONTENT }}
        run: |
          mkdir -p ~/private_keys
          echo "$KEY_CONTENT" | base64 --decode > ~/private_keys/AuthKey_$KEY_ID.p8
          echo "APPLE_API_KEY_PATH=$HOME/private_keys/AuthKey_$KEY_ID.p8" >> $GITHUB_ENV

      - name: Build + sign + notarize
        env:
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_KEY_ISSUER }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_SIGNING_IDENTITY: "Developer ID Application"
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_UPDATER_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_UPDATER_PASSPHRASE }}
        run: |
          cd packages/desktop
          bun run tauri build --target ${{ matrix.target }}

      - name: Staple notarization ticket
        run: |
          DMG=$(find packages/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/dmg -name "*.dmg")
          xcrun stapler staple "$DMG"

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: macos-${{ matrix.target }}
          path: |
            packages/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/dmg/*.dmg
            packages/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/macos/*.app.tar.gz
            packages/desktop/src-tauri/target/${{ matrix.target }}/release/bundle/macos/*.app.tar.gz.sig
```

Note: the `security set-key-partition-list` line is required on modern macOS to allow `codesign` to use the cert non-interactively. Tauri's bundling is what triggers signing + notarization when the env vars above are set; verify by checking `bundle.macOS` in `tauri.conf.json` and Tauri's macOS signing docs. If `tauri build` does not staple automatically, the explicit `xcrun stapler staple` step covers that.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): add macOS build job (signed + notarized + stapled)"
```

---

### Task 7: Windows build job (NSIS, unsigned)

**Files:**
- Modify: `.github/workflows/release.yml`

**Steps:**

- [ ] **Step 1: Append a `build-windows` job**

```yaml
  build-windows:
    name: Build Windows NSIS (unsigned)
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: dtolnay/rust-toolchain@stable
      - run: bun install --frozen-lockfile
      - name: Build
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_UPDATER_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_UPDATER_PASSPHRASE }}
        run: |
          cd packages/desktop
          bun run tauri build
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-x86_64
          path: |
            packages/desktop/src-tauri/target/release/bundle/nsis/*.exe
            packages/desktop/src-tauri/target/release/bundle/nsis/*.exe.sig
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): add Windows NSIS build job (unsigned)"
```

---

### Task 8: Linux build job (AppImage + deb + rpm + GPG sign)

**Files:**
- Modify: `.github/workflows/release.yml`

**Steps:**

- [ ] **Step 1: Append a `build-linux` job**

```yaml
  build-linux:
    name: Build Linux (AppImage + deb + rpm, GPG-signed)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: dtolnay/rust-toolchain@stable

      - name: Install Linux deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev libasound2-dev libssl-dev pkg-config dpkg-sig rpm

      - run: bun install --frozen-lockfile

      - name: Build
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_UPDATER_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_UPDATER_PASSPHRASE }}
        run: |
          cd packages/desktop
          bun run tauri build

      - name: Import GPG key
        env:
          GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          echo "$GPG_PRIVATE_KEY" | gpg --batch --import
          echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf
          echo "pinentry-mode loopback" >> ~/.gnupg/gpg.conf
          gpgconf --kill gpg-agent
          KEY_ID=$(gpg --list-secret-keys --keyid-format=long | grep '^sec' | head -1 | awk '{print $2}' | cut -d/ -f2)
          echo "GPG_KEY_ID=$KEY_ID" >> $GITHUB_ENV

      - name: Sign deb packages
        env:
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          for deb in packages/desktop/src-tauri/target/release/bundle/deb/*.deb; do
            dpkg-sig --gpg-options "--pinentry-mode loopback --passphrase $GPG_PASSPHRASE" --sign builder "$deb"
          done

      - name: Sign rpm packages
        env:
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          echo "%_gpg_name $GPG_KEY_ID" >> ~/.rpmmacros
          echo "%_gpg_path $HOME/.gnupg" >> ~/.rpmmacros
          for rpm in packages/desktop/src-tauri/target/release/bundle/rpm/*.rpm; do
            rpmsign --addsign "$rpm"
          done

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: linux-x86_64
          path: |
            packages/desktop/src-tauri/target/release/bundle/appimage/*.AppImage
            packages/desktop/src-tauri/target/release/bundle/appimage/*.AppImage.sig
            packages/desktop/src-tauri/target/release/bundle/deb/*.deb
            packages/desktop/src-tauri/target/release/bundle/rpm/*.rpm
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): add Linux build job with GPG-signed deb + rpm"
```

---

### Task 9: Aggregation job — latest.json + apt repo + dnf repo + S3 + GH Release

**Files:**
- Modify: `.github/workflows/release.yml`

**Steps:**

- [ ] **Step 1: Append an `aggregate` job**

```yaml
  aggregate:
    name: Aggregate, sign, publish
    needs: [build-macos, build-windows, build-linux]
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: artifacts/

      - name: Install tools
        run: |
          sudo apt-get update
          sudo apt-get install -y aptly createrepo-c gnupg
          curl -L https://github.com/jedisct1/minisign/releases/download/0.11/minisign-0.11-linux.tar.gz | tar xz
          sudo mv minisign-linux/x86_64/minisign /usr/local/bin/

      - name: Import GPG key
        env:
          GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          echo "$GPG_PRIVATE_KEY" | gpg --batch --import
          echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf
          echo "pinentry-mode loopback" >> ~/.gnupg/gpg.conf
          gpgconf --kill gpg-agent
          KEY_ID=$(gpg --list-secret-keys --keyid-format=long | grep '^sec' | head -1 | awk '{print $2}' | cut -d/ -f2)
          gpg --export --armor "$KEY_ID" > vox-era-releases.gpg
          echo "GPG_KEY_ID=$KEY_ID" >> $GITHUB_ENV

      - name: Generate latest.json
        env:
          VERSION: ${{ github.ref_name }}
        run: |
          VERSION=${VERSION#v}
          cat > latest.json <<EOF
          {
            "version": "$VERSION",
            "notes": "See changelog at https://vox-era.com/changelog/",
            "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "platforms": {
              "darwin-x86_64": {
                "signature": "$(cat artifacts/macos-x86_64-apple-darwin/*.app.tar.gz.sig)",
                "url": "https://github.com/programow/vox-era/releases/download/v$VERSION/$(basename artifacts/macos-x86_64-apple-darwin/*.app.tar.gz)"
              },
              "darwin-aarch64": {
                "signature": "$(cat artifacts/macos-aarch64-apple-darwin/*.app.tar.gz.sig)",
                "url": "https://github.com/programow/vox-era/releases/download/v$VERSION/$(basename artifacts/macos-aarch64-apple-darwin/*.app.tar.gz)"
              },
              "windows-x86_64": {
                "signature": "$(cat artifacts/windows-x86_64/*.exe.sig)",
                "url": "https://github.com/programow/vox-era/releases/download/v$VERSION/$(basename artifacts/windows-x86_64/*.exe)"
              },
              "linux-x86_64": {
                "signature": "$(cat artifacts/linux-x86_64/*.AppImage.sig)",
                "url": "https://github.com/programow/vox-era/releases/download/v$VERSION/$(basename artifacts/linux-x86_64/*.AppImage)"
              }
            }
          }
          EOF

      - name: Build apt repo with aptly
        env:
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          aptly repo create -distribution=stable -component=main vox-era
          aptly repo add vox-era artifacts/linux-x86_64/*.deb
          aptly publish repo \
            -gpg-key="$GPG_KEY_ID" \
            -passphrase="$GPG_PASSPHRASE" \
            -batch \
            vox-era
          mkdir -p apt
          cp -r ~/.aptly/public/* apt/

      - name: Build dnf repo with createrepo_c
        env:
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
        run: |
          mkdir -p dnf
          cp artifacts/linux-x86_64/*.rpm dnf/
          createrepo_c dnf/
          gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PASSPHRASE" --detach-sign --armor dnf/repodata/repomd.xml

      - name: Configure AWS via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1

      - name: Sync to S3
        run: |
          aws s3 cp latest.json s3://vox-era-prod/updates/latest.json
          aws s3 sync apt/ s3://vox-era-prod/apt/ --delete
          aws s3 sync dnf/ s3://vox-era-prod/dnf/ --delete
          aws s3 cp vox-era-releases.gpg s3://vox-era-prod/keys/vox-era-releases.gpg

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/updates/*" "/apt/*" "/dnf/*" "/keys/*" "/" "/changelog/*"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          generate_release_notes: true
          files: |
            artifacts/macos-x86_64-apple-darwin/*
            artifacts/macos-aarch64-apple-darwin/*
            artifacts/windows-x86_64/*
            artifacts/linux-x86_64/*
            latest.json
            vox-era-releases.gpg
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): aggregate manifest, apt, dnf, S3 sync, CloudFront invalidation, GitHub Release"
```

---

### Task 10: Production landing deploy job

**Files:**
- Modify: `.github/workflows/release.yml`

**Steps:**

- [ ] **Step 1: Append a `deploy-landing` job that runs after `aggregate`**

```yaml
  deploy-landing:
    name: Deploy landing to production
    needs: [aggregate]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Build landing
        run: cd packages/landing && bun run build

      - name: Configure AWS via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1

      - name: Sync to S3 root prefix
        run: |
          aws s3 sync packages/landing/out/ s3://vox-era-prod/ \
            --exclude "updates/*" \
            --exclude "apt/*" \
            --exclude "dnf/*" \
            --exclude "keys/*" \
            --exclude "previews/*" \
            --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/" "/index.html" "/privacy/*" "/changelog/*" "/_next/*"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): deploy landing to production after aggregate completes"
```

---

## Section 3: Slash commands

### Task 11: `/release` slash command

**Files:**
- Create: `.claude/commands/release.md`

**Steps:**

- [ ] **Step 1: Create**

```markdown
---
description: Cut a new release — verify clean tree on main, bump version, generate changelog, tag, push.
---

**Pre-flight:**
1. Verify `git rev-parse --abbrev-ref HEAD` is `main`. If not, refuse.
2. Verify `git status` is clean. If not, refuse.
3. Verify `git fetch origin && git rev-list HEAD..origin/main --count` is 0 (we're up to date).

**Determine the next version:**
4. Read the most recent tag: `git describe --tags --abbrev=0 2>/dev/null || echo v0.0.0`
5. List commits since that tag: `git log <last-tag>..HEAD --pretty=format:%s`
6. Apply semver:
   - Any `BREAKING CHANGE:` body line → major bump
   - Any `feat:` → minor bump
   - Otherwise (only `fix:`, `chore:`, etc.) → patch bump
7. Print the proposed new version. Ask the user to confirm or override.

**Bump versions:**
8. Update `version` in:
   - `package.json`
   - `packages/desktop/package.json`
   - `packages/desktop/src-tauri/Cargo.toml`
   - `packages/desktop/src-tauri/tauri.conf.json`
   - `packages/landing/package.json`

**Generate changelog entry:**
9. Prepend a section to `CHANGELOG.md`:
   ```
   ## v<NEW_VERSION> (YYYY-MM-DD)
   ### Features
   - <feat: subject>
   ### Fixes
   - <fix: subject>
   ### Other
   - <chore/refactor/etc subject>
   ```

**Commit, tag, push:**
10. `git add -A && git commit -m "chore(release): v<NEW_VERSION>"`
11. `git tag v<NEW_VERSION>`
12. `git push origin main && git push origin v<NEW_VERSION>`
13. Print the GitHub Actions URL where the release workflow now runs.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/release.md
git commit -m "feat(claude): add /release slash command for version bump + tag"
```

---

## Section 4: First test release validating end-to-end

### Task 12: Tag `v0.1.0-alpha` and watch the pipeline

**Files:** none (manual)

**Steps:**

- [ ] **Step 1: Run `/release` (or its manual equivalent) and pick `0.1.0-alpha`**

Follow the slash command's steps. After push:

- [ ] **Step 2: Watch the workflow on GitHub Actions**

Visit `https://github.com/programow/vox-era/actions`. The `Release` workflow should be running. Expected: macOS / Windows / Linux build jobs run in parallel; aggregate runs after all three; landing deploy runs after aggregate.

- [ ] **Step 3: Verify artifacts on GitHub Releases**

Visit `https://github.com/programow/vox-era/releases/tag/v0.1.0-alpha`. Expected: DMGs (x64 + arm64), Windows .exe, Linux AppImage + deb + rpm, latest.json, vox-era-releases.gpg.

- [ ] **Step 4: Verify S3 + CloudFront**

```bash
curl -fsSL https://vox-era.com/updates/latest.json | jq .
curl -fsSI https://vox-era.com/apt/dists/stable/Release
curl -fsSI https://vox-era.com/dnf/repodata/repomd.xml
curl -fsSL https://vox-era.com/keys/vox-era-releases.gpg | head -3
```
Expected: each succeeds; `latest.json` contains version `0.1.0-alpha`.

- [ ] **Step 5: Smoke test installs**

On each platform you have access to:
- macOS: download DMG, mount, drag to Applications, launch. Expect no Gatekeeper warning. Grant Microphone + Accessibility (Fn key) when prompted. Press Fn, dictate, verify text pastes.
- Windows: download .exe, run installer (expect SmartScreen warning, click "Run anyway"). Launch, configure provider key, dictate.
- Linux: download AppImage, `chmod +x`, run; OR `apt install vox-era` after the apt repo setup commands; OR `dnf install vox-era`. Validate the install command from `docs/install-linux.md`.

If any of these fail, file a follow-up issue and iterate.

---

## Section 5: Documentation

### Task 13: `docs/build-and-release.md`

**Files:**
- Create: `docs/build-and-release.md`

**Steps:**

- [ ] **Step 1: Author**

```markdown
# Build & Release

## Local build (unsigned)

```bash
cd packages/desktop
bun run tauri:build
```
Produces unsigned artifacts in `src-tauri/target/release/bundle/`.

## Local signed build (macOS only, requires Apple Developer cert in your Keychain)

```bash
cd packages/desktop
APPLE_SIGNING_IDENTITY="Developer ID Application: Programow" bun run tauri:build
```

## Production releases

Releases are tag-triggered. Push a `v*` tag and the `Release` workflow runs:

1. Builds DMG (x86_64 + aarch64) on macOS, NSIS .exe on Windows, AppImage + deb + rpm on Linux
2. macOS DMGs are signed with Developer ID + notarized with App Store Connect API key + stapled
3. Linux deb/rpm are GPG-signed; AppImage is not (convention)
4. Aggregation job:
   - Generates `latest.json` (Tauri auto-update manifest), signed with minisign
   - Builds apt repo with `aptly` (signed with GPG)
   - Builds dnf repo with `createrepo_c` (signed with GPG)
   - Syncs everything to S3 (`s3://vox-era-prod/{updates,apt,dnf,keys}/`)
   - Invalidates CloudFront
   - Creates GitHub Release with all artifacts attached
5. Landing deploy job rebuilds and deploys the landing site to `s3://vox-era-prod/`

## Required GitHub Secrets

| Secret | What it is | Where it comes from |
|---|---|---|
| `APPLE_DEVELOPER_ID_CERT` | base64 of .p12 export | Keychain Access → export your Developer ID Application identity |
| `APPLE_DEVELOPER_ID_PASSWORD` | .p12 export password | The password you set when exporting |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID | https://appstoreconnect.apple.com/access/api |
| `APPLE_API_KEY_ISSUER` | API Key Issuer UUID | Same page |
| `APPLE_API_KEY_CONTENT` | base64 of .p8 file | Same page (downloaded once) |
| `TAURI_UPDATER_PRIVATE_KEY` | minisign private key | `bunx @tauri-apps/cli signer generate` |
| `TAURI_UPDATER_PASSPHRASE` | minisign passphrase | The passphrase you set |
| `GPG_PRIVATE_KEY` | armored GPG private key | `gpg --export-secret-keys --armor "Vox Era Releases"` |
| `GPG_PASSPHRASE` | GPG key passphrase | The passphrase you set when generating |
| `AWS_DEPLOY_ROLE_ARN` | OIDC role ARN | `aws iam get-role --role-name vox-era-ci` |
| `CLOUDFRONT_DISTRIBUTION_ID` | distribution id | CloudFront console |
| `PULUMI_ACCESS_TOKEN` | Pulumi Cloud CI access token | https://app.pulumi.com/account/tokens (1-year expiration; rotate annually) |

## Cutting a release

Use the `/release` slash command. It verifies a clean main, computes the next version from conventional commits, bumps versions across files, generates a changelog entry, commits, tags, and pushes. The push triggers the workflow.

## Stapling caveat

If `tauri build` does not staple notarization tickets automatically, the workflow runs `xcrun stapler staple <dmg>` explicitly. Stapled DMGs work offline on Gatekeeper.

## Key rotation

- **GPG:** generate a new key, sign the next release with both old and new for one release cycle, then drop the old one. Update `s3://vox-era-prod/keys/vox-era-releases.gpg` to the new pubkey.
- **Tauri minisign:** ship one release that's signed with both keys (Tauri supports trusted-public-key fallback) and the new pubkey is embedded in `tauri.conf.json`. After all users have updated, drop the old key.
```

- [ ] **Step 2: Commit**

```bash
git add docs/build-and-release.md
git commit -m "docs(release): add build-and-release runbook"
```

---

### Task 14: `docs/install-linux.md`

**Files:**
- Create: `docs/install-linux.md`

**Steps:**

- [ ] **Step 1: Author**

```markdown
# Install Vox Era on Linux

Pick one of three install methods.

## Option 1: `apt` (Debian / Ubuntu)

```bash
curl -fsSL https://vox-era.com/keys/vox-era-releases.gpg | sudo tee /etc/apt/keyrings/vox-era.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/vox-era.gpg] https://vox-era.com/apt stable main" | sudo tee /etc/apt/sources.list.d/vox-era.list
sudo apt update && sudo apt install vox-era
```

Updates: `sudo apt upgrade vox-era` (or it comes through `apt upgrade`).

## Option 2: `dnf` (Fedora / RHEL)

```bash
sudo rpm --import https://vox-era.com/keys/vox-era-releases.gpg
sudo tee /etc/yum.repos.d/vox-era.repo <<EOF
[vox-era]
name=Vox Era Stable
baseurl=https://vox-era.com/dnf
gpgcheck=1
gpgkey=https://vox-era.com/keys/vox-era-releases.gpg
EOF
sudo dnf install vox-era
```

Updates: `sudo dnf upgrade vox-era`.

## Option 3: AppImage (any distro)

Download from `https://github.com/programow/vox-era/releases/latest`, then:

```bash
chmod +x Vox_Era-*.AppImage
./Vox_Era-*.AppImage
```

The in-app updater can replace the AppImage in place; no apt/dnf needed.

## Verify package signatures

The public key fingerprint is published at `https://vox-era.com/keys/vox-era-releases.gpg` and on the GitHub Releases page. Verify:

```bash
gpg --verify Vox_Era-*.deb       # for deb users not using apt
rpm --checksig Vox_Era-*.rpm     # for rpm users not using dnf
```

## Troubleshooting

- `apt update` says "NO_PUBKEY": import the key first (Option 1 step 1).
- `gpgcheck` failures: re-import the public key from `https://vox-era.com/keys/vox-era-releases.gpg`.
- AppImage refuses to launch on systems without FUSE: `apt install libfuse2` (Ubuntu) or `dnf install fuse-libs` (Fedora).
```

- [ ] **Step 2: Commit**

```bash
git add docs/install-linux.md
git commit -m "docs(release): add Linux install instructions for apt, dnf, and AppImage"
```

---

### Task 15: `docs/ci-cd.md`

**Files:**
- Create: `docs/ci-cd.md`

**Steps:**

- [ ] **Step 1: Author**

```markdown
# CI/CD

## Infrastructure as Code (Pulumi)

All AWS + Cloudflare resources are managed by `packages/infra/` (Pulumi, TypeScript). State and secrets are managed by **Pulumi Cloud** under the personal account `guilherme-vozniak-a-gmail-com` (stack: `guilherme-vozniak-a-gmail-com/vox-era-infra/prod`). The AWS provider used inside the stack still runs against the local profile `voxera` (locally) or via OIDC role assumption (in CI).

Run `AWS_PROFILE=voxera bun --filter @vox-era/infra preview` to see pending changes; `AWS_PROFILE=voxera bun --filter @vox-era/infra up` to apply. The `pulumi` CLI must be logged in (`pulumi login`); CI uses `PULUMI_ACCESS_TOKEN`.

See `packages/infra/README.md` for details. Bootstrap steps (Pulumi Cloud login + Cloudflare token generation) are documented in Plan D Task 4.

## Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push to `main`, PRs | lint + typecheck + desktop tests (mac/win/linux) + landing tests |
| `pr-preview.yml` | PRs touching `packages/landing/**` | build + upload landing preview to `s3://vox-era-prod/previews/pr-N/`, comment on PR |
| `release.yml` | tag `v*` | build + sign + notarize + GPG-sign + apt/dnf repo + minisign manifest + S3 sync + GitHub Release + landing prod deploy |

## Branch protection on `main`

Not configured by Plan D — the repo stays private through launch. Classic branch protection rules require GitHub Pro on private repos (free for public repos), so enabling protection is deferred until the user decides to either:

1. Make the repo public (`gh repo edit programow/vox-era --visibility public --accept-visibility-change-consequences`), OR
2. Upgrade to GitHub Pro

When one of those happens, run this one-shot command to enable protection:

```bash
gh api -X PUT repos/programow/vox-era/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint & Typecheck",
      "Test desktop / ubuntu-latest",
      "Test desktop / macos-latest",
      "Test desktop / windows-latest",
      "Test landing"
    ]
  },
  "enforce_admins": false,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 0
  },
  "restrictions": null
}
JSON
```

Until then: PRs are convention, CI must be green before merging, but nothing is technically enforced. With 2 contributors this works because either of you sees the other's PRs and runs CI.

## OIDC vs static AWS keys

We use OIDC role assumption (`AWS_DEPLOY_ROLE_ARN` secret) over static `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` because:
- No long-lived credentials to leak/rotate
- Per-job tokens scoped to the role's trust policy
- Trust policy restricts which repos can assume the role

Setup is documented in `docs/aws-setup.md`.

## Concurrency control

- CI cancels stale runs on new pushes to the same PR (`concurrency` block in `ci.yml`)
- Releases do NOT cancel — once a release starts, it runs to completion (`cancel-in-progress: false`)
- PR previews replace the previous preview for the same PR

## Required Secrets reference

See `docs/build-and-release.md` for the full list and how each is obtained.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ci-cd.md
git commit -m "docs(release): add CI/CD overview"
```

---

## Section 6: Phase 4 cleanup

### Task 16: Delete `legacy/electron/`

**Files:**
- Remove: `legacy/electron/` (entire directory)
- Modify: `.gitignore` (drop `legacy/electron/` lines)

**Steps:**

- [ ] **Step 1: Verify Vox Era reaches feature parity**

Manual: confirm shortcut→record→transcribe→paste works on at least one platform with the v0.1.0-alpha install (Task 12 covers this).

- [ ] **Step 2: Remove the legacy directory**

```bash
git rm -r legacy/
```

- [ ] **Step 3: Drop legacy entries from `.gitignore`**

Remove these lines if present:
```
# Legacy Electron app artifacts
legacy/electron/node_modules/
legacy/electron/dist/
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: remove legacy Electron Ada — replaced by Vox Era Tauri build"
```

---

### Task 17: Final docs sweep — Ada/Electron references

**Files:** any remaining file with stale references

**Steps:**

- [ ] **Step 1: Audit**

Run:
```bash
grep -rn "\bAda\b\|\bada\b\|com\.programow\.ada\|programow/ada" --exclude-dir=legacy --exclude-dir=node_modules --exclude-dir=docs/superpowers --exclude-dir=.git --exclude=*.lockb --exclude=CHANGELOG.md . | grep -v -E "^[^:]*:[0-9]+: *(//|#|<!--|/\*).*originally Ada"
```

- [ ] **Step 2: Replace forward-looking references**

For each match, decide:
- Historical fact ("originally named Ada", commit messages, changelog entries) → leave
- Forward-looking ("open Ada", "Ada needs microphone access", config strings, deep links) → replace with `Vox Era` / `voxera` / `vox-era`

- [ ] **Step 3: Verify nothing critical is left**

Run the same grep again; should return only historical/changelog matches.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: sweep remaining Ada → Vox Era references in forward-looking contexts"
```

---

### Task 18: Update root `README.md` and `CLAUDE.md` to reflect end state

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Steps:**

- [ ] **Step 1: Update `README.md`**

Replace the "Status" line that previously said "in active migration from a legacy Electron build" with:

```
**Status:** Vox Era v0.1.0-alpha shipped. Cross-platform (macOS, Windows, Linux). Auto-update active.
```

Update the Install section to point at real GitHub release assets instead of placeholders.

Remove any reference to `legacy/`.

- [ ] **Step 2: Update `CLAUDE.md`**

Replace the "What Vox Era is" section's first paragraph (referencing migration in flight) with end-state language. Verify the slash commands inventory is complete (all of `/dev-desktop`, `/dev-landing`, `/test`, `/test-fast`, `/typecheck`, `/lint`, `/coverage`, `/release`, `/add-provider`, `/build-clean`, `/diagnose`, `/reset-perms`, `/sync-docs`).

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: finalize root README and CLAUDE.md for Vox Era end state"
```

---

### Task 19: Open the PR for `execution` and merge

**Files:** none (PR + merge actions)

**Steps:**

- [ ] **Step 1: Open the PR**

```bash
gh pr create --base main --head execution --title "Vox Era: Tauri monorepo migration (Plans A–D)" --body "$(cat <<'EOF'
## Summary

- Bun monorepo with `@vox-era/desktop` and `@vox-era/landing`
- Tauri 2.x desktop app with 9 STT providers, OS-keychain BYOK, SQLite history, neobrutalism React UI, macOS Fn-key shortcut
- Next.js static landing at vox-era.com with privacy + changelog routes
- Full release pipeline: macOS notarized DMG + Windows NSIS + Linux AppImage/deb/rpm with GPG-signed apt + dnf repos
- Apache 2.0 license, zero telemetry, comprehensive docs

## Test plan

- [x] All CI jobs green on macOS / Windows / Linux
- [x] First signed release v0.1.0-alpha installed and validated on at least one platform per OS
- [x] Auto-update path verified end-to-end
- [x] Landing live at vox-era.com

## Documentation

- Plans: `docs/superpowers/plans/2026-05-03-plan-{a,b,c,d}-*.md` (gitignored, kept locally)
- Architecture: `docs/architecture.md`
- Permissions: `docs/permissions.md`
- Secrets: `docs/secrets.md`
- Providers: `docs/providers.md`
- Build/release: `docs/build-and-release.md`
- Linux install: `docs/install-linux.md`
- CI/CD: `docs/ci-cd.md`
EOF
)"
```

- [ ] **Step 2: Merge once CI is green**

Use rebase merge to preserve linear history. Branch protection isn't enabled yet (deferred until the repo goes public or upgrades to Pro — see `docs/ci-cd.md`), so the merge button is technically available even with red CI. Convention: don't merge red.

```bash
gh pr merge --rebase --delete-branch
```

- [ ] **Step 3: Delete the branch**

```bash
git checkout main && git pull && git branch -d execution
git push origin --delete execution
```

The `tech-stack` branch is preserved on `origin` as the planning/spec record. Don't delete it.

---

## Plan D complete

At this point:

- [x] All credentials configured in GitHub Secrets (Apple, Tauri minisign, GPG, AWS OIDC)
- [x] AWS S3 + CloudFront + ACM + IAM/OIDC + Cloudflare DNS wired to `vox-era.com` via Pulumi (`packages/infra/`)
- [x] `release.yml` workflow ships signed DMG + Windows + Linux artifacts on `v*` tags
- [x] apt + dnf repos hosted on S3 with GPG-signed metadata
- [x] Auto-update manifest (`latest.json`) signed with minisign and served at `https://vox-era.com/updates/latest.json`
- [x] First test release `v0.1.0-alpha` shipped and validated end-to-end
- [x] `/release` slash command
- [x] `docs/build-and-release.md`, `docs/install-linux.md`, `docs/ci-cd.md`, `docs/aws-setup.md`
- [x] Phase 4 cleanup: `legacy/electron/` deleted, all forward-looking Ada references replaced, root README + CLAUDE.md reflect end state
- [x] `execution` merged to `main` via PR (`tech-stack` preserved as planning record)

**Vox Era is live.**
