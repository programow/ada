---
name: pulumi-cloud-iac
description: Use when setting up Pulumi infrastructure-as-code with Pulumi Cloud as the state backend — personal-account-managed state and secrets, AWS provider with named profile, Cloudflare provider via stack-config token
---

# Pulumi Cloud IaC

Pulumi Cloud (`app.pulumi.com`) manages stack state and secrets server-side. Vox Era uses a personal Pulumi Cloud account (`guilherme-vozniak-a-gmail-com`) as the backend — free for personal use, no S3 bucket or AWS KMS key to bootstrap.

## Login

Local CLI (one-time browser auth):

```bash
pulumi login
```

This stores credentials in `~/.pulumi/credentials.json`. The CLI now points at `https://api.pulumi.com` by default; `PULUMI_BACKEND_URL` should not be set.

CI uses a long-lived access token instead. Mint one at https://app.pulumi.com/account/tokens (description: `vox-era-ci`, expiration: 1 year, rotate annually). Set as the `PULUMI_ACCESS_TOKEN` env var in GitHub Actions; the CLI picks it up automatically.

## Stack init

No `--secrets-provider` flag; Pulumi Cloud's built-in secrets manager handles state encryption.

```bash
cd packages/infra
pulumi stack init guilherme-vozniak-a-gmail-com/prod
```

Fully-qualified stack identifier: `<pulumi-org>/<project>/<stack>`, e.g. `guilherme-vozniak-a-gmail-com/vox-era-infra/prod`. Pulumi Cloud renders this at `https://app.pulumi.com/<pulumi-org>/<project>/<stack>`.

## `Pulumi.yaml` (project metadata)

```yaml
name: vox-era-infra
runtime: nodejs
description: Vox Era infrastructure (AWS S3, CloudFront, ACM, IAM/OIDC + Cloudflare DNS)
```

No `backend:` block. Pulumi Cloud is the default backend when the CLI is logged in to `app.pulumi.com`. Including a `backend:` block here would force a different (self-hosted) backend.

## AWS provider with named profile

Pulumi Cloud only manages state — your AWS provider still needs credentials. Inline a provider so all resources tag along; otherwise Pulumi uses the default AWS env (often the wrong account).

```typescript
import * as aws from '@pulumi/aws';

const awsProvider = new aws.Provider('voxera', {
    profile: 'voxera',
    region: 'us-east-1',
});

const bucket = new aws.s3.BucketV2('site', { bucket: 'site-prod' }, { provider: awsProvider });
```

Local: `AWS_PROFILE=voxera pulumi up --stack prod`. CI: assume the OIDC role first, then `pulumi up` (the AWS provider reads the role's temporary credentials from env).

## Encrypted stack config

Pulumi Cloud stores config secrets in encrypted form server-side. The local `Pulumi.<stack>.yaml` shows them as `secure: "v1:..."` ciphertext.

```bash
pulumi config set --stack prod domain vox-era.com
pulumi config set --stack prod --secret cloudflareApiToken xyz...
```

In code:

```typescript
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const domain = config.require('domain');
const token = config.requireSecret('cloudflareApiToken'); // pulumi.Output<string>, decrypted at runtime
```

No `AWS_PROFILE` env needed for `pulumi config set` — the secret store is Pulumi Cloud, not AWS.

## Outputs to GitHub Secrets

```bash
ROLE_ARN=$(pulumi stack output ciRoleArn --stack prod)
gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN" --repo programow/vox-era
```

Use `pulumi stack output --json` for machine-parseable output across many keys at once.

## CI authentication

```yaml
# .github/workflows/release.yml fragment
- name: Pulumi up
  uses: pulumi/actions@v6
  with:
    command: up
    stack-name: guilherme-vozniak-a-gmail-com/prod
    work-dir: packages/infra
  env:
    PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
    AWS_REGION: us-east-1
```

Note: `pulumi/actions` writes the access token into the runner's Pulumi credentials file before running the command. AWS credentials still need to come from `aws-actions/configure-aws-credentials` (OIDC role assumption) earlier in the job.

## State recovery

Pulumi Cloud retains every `pulumi up` snapshot (`pulumi stack history`). Roll back via:

```bash
pulumi stack export --stack prod --version <N> > stack.json
pulumi stack import --file stack.json --stack prod
```

For disaster planning, capture an offline backup as a CI artifact on every release:

```bash
pulumi stack export --stack prod > stack-export-$(date +%Y%m%d).json
```

## Common pitfalls

- **`pulumi login` to the wrong backend** — if `PULUMI_BACKEND_URL` is set or you previously logged into an S3 backend, `pulumi login` keeps using it. Run `pulumi logout` first, then `pulumi login` (no URL) to default to Pulumi Cloud.
- **Stack name without org prefix** — `pulumi stack init prod` (no `<org>/` prefix) creates an individual-account stack. Always use `<org>/<stack>` form when sharing or in CI.
- **`AWS_PROFILE` not set when running `pulumi up`** — the AWS provider reads env vars; Pulumi Cloud has nothing to do with AWS auth. Either prefix every command or set in shell.
- **`PULUMI_ACCESS_TOKEN` rotated without updating GitHub Secrets** — release pipeline fails with `401 Unauthorized`. Rotate annually with calendar reminder.
- **Pulumi Cloud free-tier limits** — personal accounts are free for individual use. If multiple maintainers need write access, an Individual or Team plan is required. Vox Era is single-maintainer at v1.

## References

- https://www.pulumi.com/docs/concepts/state/#pulumi-cloud-backend
- https://www.pulumi.com/docs/concepts/config/#secrets
- https://www.pulumi.com/docs/using-pulumi/continuous-delivery/github-actions/
- https://www.pulumi.com/registry/packages/aws/api-docs/provider/
- https://www.pulumi.com/registry/packages/cloudflare/api-docs/provider/
