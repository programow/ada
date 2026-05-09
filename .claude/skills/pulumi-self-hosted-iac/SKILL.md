---
name: pulumi-self-hosted-iac
description: Use when setting up Pulumi infrastructure-as-code without a Pulumi Cloud account — state in S3, secrets encrypted via AWS KMS, AWS provider with named profile
---

# Pulumi self-hosted IaC

Pulumi can fully self-host (no app.pulumi.com account) by storing state in S3 and encrypting secrets via AWS KMS. Same model as Terraform's S3 backend.

## Bootstrap problem

The state bucket and KMS key must exist BEFORE Pulumi runs. Pulumi can't manage its own state bucket. Create them with raw `aws` CLI once:

```bash
aws --profile voxera s3api create-bucket --bucket project-pulumi-state --region us-east-1
aws --profile voxera s3api put-bucket-versioning --bucket project-pulumi-state --versioning-configuration Status=Enabled
aws --profile voxera s3api put-bucket-encryption --bucket project-pulumi-state --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws --profile voxera s3api put-public-access-block --bucket project-pulumi-state --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

KMS_KEY_ID=$(aws --profile voxera kms create-key --description "Pulumi secrets" --query 'KeyMetadata.KeyId' --output text)
aws --profile voxera kms create-alias --alias-name alias/project-pulumi --target-key-id "$KMS_KEY_ID"
```

## Login + stack init

```bash
pulumi login s3://project-pulumi-state?region=us-east-1
AWS_PROFILE=voxera pulumi stack init prod \
  --secrets-provider="awskms://alias/project-pulumi?region=us-east-1&awssdk=v2"
```

The `awssdk=v2` query param resolves SDK version mismatch errors when present.

## Pulumi.yaml backend declaration

```yaml
name: my-infra
runtime: nodejs
backend:
  url: s3://project-pulumi-state?region=us-east-1
```

Declaring the backend in the project file means any developer cloning the repo can `pulumi login` to the same backend without out-of-band coordination.

## AWS provider with named profile

Inline a provider so all resources tag along:

```typescript
import * as aws from '@pulumi/aws';

const awsProvider = new aws.Provider('voxera', {
    profile: 'voxera',
    region: 'us-east-1',
});

const bucket = new aws.s3.BucketV2('site', { bucket: 'site-prod' }, { provider: awsProvider });
```

Without a per-resource `{ provider }` argument, Pulumi uses the default AWS env (which may be the wrong account).

## Encrypted stack config

```bash
AWS_PROFILE=voxera pulumi config set --stack prod domain example.com
AWS_PROFILE=voxera pulumi config set --stack prod --secret cloudflareApiToken xyz...
```

In code:

```typescript
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const domain = config.require('domain');
const token = config.requireSecret('cloudflareApiToken');  // pulumi.Output<string>, decrypted lazily
```

## Outputs to GitHub Secrets

```bash
ROLE_ARN=$(AWS_PROFILE=voxera pulumi stack output ciRoleArn --stack prod)
gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" --repo programow/vox-era
```

Use `pulumi stack output --json` for machine-parseable output across many keys at once.

## Common pitfalls

- **Forgot `--secrets-provider` on stack init** → `pulumi config set --secret` falls back to passphrase mode. Recover with `pulumi stack change-secrets-provider awskms://...`
- **`AWS_PROFILE` not set when running pulumi** → wrong AWS account. Pulumi's AWS provider reads env vars, not a Pulumi config file; either prefix every command or set in shell.
- **State bucket name conflicts** → S3 bucket names are globally unique. Pick something namespaced.
- **KMS key in wrong region** → secrets provider URL must match region of KMS key.
- **Multiple devs see different state** → they didn't `pulumi login s3://...` to the same backend. Pulumi.yaml backend declaration prevents this.

## References

- https://www.pulumi.com/docs/concepts/state/
- https://www.pulumi.com/docs/concepts/config/#configuring-secrets-encryption
- https://www.pulumi.com/registry/packages/aws/api-docs/provider/
- https://www.pulumi.com/registry/packages/cloudflare/api-docs/provider/
