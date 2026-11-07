# Verified release downloads

[Documentation index](README.md) · [Release runbook](release.md)

The package's primary distribution is npm. A maintainer can also attach the
**same published archive** and its **original signed SLSA provenance** to an
existing GitHub Release. This gives users a portable, verifiable download;
it is not another build, npm publication, or signing operation.

## Verify a downloaded archive

Download the version's `annotations-X.Y.Z.tgz`,
`annotations-X.Y.Z.tgz.sigstore.json`, and `annotations-X.Y.Z.verify.md` from its
release assets, when present. Use a supported Cosign release with Sigstore bundle
verification. For example, for version 0.8.2:

```bash
cosign verify-blob-attestation \
  --type 'https://slsa.dev/provenance/v1' \
  --bundle annotations-0.8.2.tgz.sigstore.json \
  --certificate-identity 'https://github.com/Ponchia/bronto-annotations/.github/workflows/release.yml@refs/tags/v0.8.2' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  --certificate-github-workflow-sha 'bb83813c8d593e0b722ddedf0b0bb66825b2b2e5' \
  annotations-0.8.2.tgz
```

Cosign 2.x additionally requires `--new-bundle-format`; Cosign 3.x uses the bundle
format by default. See [Sigstore's npm provenance verification example](https://blog.sigstore.dev/cosign-verify-bundles/).
Keep signature, expected identity, transparency and archive-digest verification
on. After cryptographic verification, compare the signed SLSA
`resolvedDependencies` Git commit with the expected immutable release commit.
The accompanying verification file records that commit and the npm SHA-512
integrity. Reading JSON or comparing an unauthenticated checksum alone is not
signature verification.

GitHub's automatically generated source archives are different from the npm
package. The mirror contains the published package, including compiled outputs,
without altering its bytes. The Sigstore file retains the original signed DSSE
payload, signatures, certificate and transparency-log evidence.

## Maintainer procedure

Only use an existing published tag reachable from protected `main`, whose
`package.json` version matches the tag and whose GitHub Release already exists.
The current source-locked publication tooling audit must pass. The workflow runs
from `main` and uses a separate **release-assets** review environment. Before a
job references that environment, a read-only preflight verifies it already exists,
permits only the `main` branch, and requires the configured Ponchia maintainer's
approval. A missing or broader policy fails closed; the workflow never creates or
configures environments. It needs Actions read permission only for that check.

The maintainer must explicitly configure this separate boundary before first use.
The tag-only `npm-publish` environment stays unchanged. Asset mirroring performs
no npm mutation and requests no signing identity token. The review is a real
maintainer gate, not a claim of an independent reviewer or disabled admin bypass.

First verify and inspect the plan without uploading:

```bash
gh workflow run mirror-release-assets.yml \
  --repo Ponchia/bronto-annotations --ref main \
  -f release_tag=v0.8.2 -f upload=false
```

After inspecting the evidence, dispatch the same workflow with `-f upload=true`
and complete its normal maintainer review. Do not run the original npm publish
workflow to add downloads to an already-published release.

The workflow obtains fresh registry metadata and actual archive bytes. It checks
the SHA-512, installs the exact version into a clean consumer, and runs the
source-locked npm signature audit with attestations. The existing identity
verifier checks the signed package digest, repository, release workflow, tag and
commit. The audited publisher's patched Sigstore verifier additionally enforces
an exact GitHub Actions issuer, the original release workflow/tag certificate
identity, and its issuer-certified source-commit OID. Payload fields alone are
not a signer identity policy. Only then does `scripts/mirror-release-assets.mjs` inspect GitHub assets.
An arbitrary saved audit JSON file is not a substitute for that successful
cryptographic audit; the script's local fixture interface assumes this boundary.

## Retry and conflict behavior

Every expected existing asset is downloaded and compared byte-for-byte by digest
before any upload. A matching set is a no-op; a partial matching set can be
completed. An asset with a matching name but different bytes, an incomplete
upload, a moved tag, a missing release or unverifiable npm evidence fails closed.
The script never uses an overwrite flag or deletes an existing asset. Uploads
address the inspected numeric release ID, not a tag that could resolve to a
replacement release between checking and writing.

A lost upload response is inspected rather than blindly retried. The operation
accepts a now-visible exact match; otherwise it fails with an unconfirmed outcome.
Inspect the release and rerun the verified workflow to resume. Several asset
uploads are not a transaction: an interrupted run can leave a partial set, which
a later verified run can complete without replacing it.

The companion files are deterministic for the verified package and original
bundle. Do not alter a previously mirrored verification file casually: a changed
same-name file is a conflict that requires an explicit maintainer decision.

## Scope of the evidence

An asset mirror does not change package support, security policy, release tags,
or the npm dist-tags. It does not fix the separate trusted-publisher permission
needed to manage npm channels. OpenSSF Scorecard's release check discovers
signature-shaped assets but does not verify signatures itself; the cryptographic
checks above remain necessary regardless of the displayed score.
