Security

CodeRifts issues signed decisions about proposed contract changes and binds authorization to a specific change and operation. This file states what that does and does not protect, where the boundary sits, and how to report a problem.

The same discipline applies here as in the product: every proof CodeRifts emits carries a does_not_prove field generated from what was actually measured. This file is the repository form of that field.

Reporting a vulnerability

Email hello@coderifts.com. Please include what you did, what happened, and what you expected. Do not open a public issue for a suspected vulnerability.

We aim to acknowledge within three working days. We are a small team; there is no bug bounty.

What this package does
Calls the CodeRifts API to evaluate a proposed contract change (authorizeChangeSet) and to ask whether a receipt currently authorizes an intended operation.
Verifies a chain receipt you already hold, locally: no network call, no key download, no CodeRifts server. The verifier refuses to fetch a key it was not given.
Reports, in machine-readable form, what a given local verdict does not establish.

The server path verifyReceiptViaServer is a mirror of what CodeRifts currently says (revocation, issuer clock). It is not the offline proof. Local verifyReceipt cannot see revocation.

Known containment gaps

These are measured limits, not hypotheticals. Each one is stated in the product output as well.

This is not a sandbox. CodeRifts does not isolate, contain, or restrict what a process on your machine can do. It decides whether a change is authorized; it does not confine execution.

This package does not wrap tools. The runtime guarded table is @coderifts/agent-guard. A call that never goes through authorizeChangeSet is invisible to CodeRifts, and this SDK does not claim to see it.

A verified receipt is not permission to mutate. The signature layer and the authorization layer are separate. A receipt proves what was decided; it does not by itself entitle a caller to perform the operation. A local valid: true is authenticity, not authorization.

A stolen signing key still signs. Cryptographic verification proves that a key signed a payload. It does not prove the key was held by the party you expect. Key custody is outside this system's control; rotation and registry state are the operator's responsibility. A key compromised a minute ago still verifies locally — nothing local can know.

The environment is asserted by the host. Values the host reports about its own environment are taken as asserted, not verified. An executor that lies about itself is outside what any receipt can settle. A valid signature over those bytes is not a measurement of the environment.

Supported versions

Security fixes are applied to the current published release of each package. Older versions are not patched. Published versions, their commits and their integrity digests are listed in the public release provenance records.

Verifying what we ship

Every published release is pinned in a frozen release set, and the acceptance run that measures it uses only public artifacts: the packages from the registry, the signed tags, and the public provenance records. You can run it yourself — you do not need to take our word for any claim in this file.
