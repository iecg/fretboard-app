# Branch Protection Rules

## Overview

This document outlines the branch protection rules that must be manually configured in GitHub to enforce code quality and prevent accidental merges.

## Required Configuration

### Protected Branch: `main`

Go to: **Settings → Branches → Branch protection rules**

#### 1. **Require a pull request before merging**
- ✅ Enabled
- ✅ Require at least 1 approval
- ✅ Dismiss stale pull request approvals when new commits are pushed

#### 2. **Require status checks to pass before merging**
- ✅ Enabled
- ✅ Require branches to be up to date before merging

**Required Status Checks:**
```
✓ CI / Tests
✓ CI / Build  
✓ Quality Gate
```

#### 3. **Require code reviews**
- ✅ Require at least 1 approval
- ✅ Require review from Code Owners (optional)
- ✅ Dismiss stale pull request approvals

#### 4. **Restrict who can push to matching branches** (Optional)
- ✅ Allow pushes from: admins only

#### 5. **Include administrators**
- ⚠️ Consider: Do admins need to bypass rules?
- Recommendation: ✅ Enabled (enforce rules for everyone)

#### 6. **Require conversation resolution before merging**
- ✅ Enabled (all conversations must be resolved)

---

## Protected Branch: `develop` (Optional)

Apply similar rules but with less strict requirements:

- ✅ Require PR before merge (1 approval)
- ✅ Require status checks pass
- ❌ Do NOT restrict pushes to admins
- ✅ Allow direct commits in exceptional cases

---

## Workflow

With these rules in place:

### ✅ What's ALLOWED:
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git commit -m "feat: Add feature"

# Push to origin
git push origin feature/my-feature

# Open PR on GitHub
# Get 1 approval
# All checks pass
# Merge via GitHub UI
```

### ❌ What's BLOCKED:
```bash
# This will be rejected by GitHub
git push origin main
# Error: You cannot push directly to main

# This will also be blocked
git push origin develop --force
# Error: Force push not allowed
```

---

## Status Checks Required

The following CI/CD checks must pass:

| Check | Workflow | Purpose |
|-------|----------|---------|
| `CI / Tests` | ci.yml | Runs all tests on Node 18 & 20 |
| `CI / Build` | ci.yml | Verifies production build succeeds |
| `Quality Gate` | ci.yml | Ensures all previous checks passed |

Additional checks (informational):
- Coverage report (informational, not blocking)
- PR validation (informational, not blocking)

---

## How to Verify Configuration

1. Go to: **Settings → Branches**
2. Click on the branch protection rule for `main`
3. Verify all settings match above
4. Test by attempting to push directly: `git push origin main`
   - Should be rejected with message about branch protection

---

## Updating Rules

To modify rules:
1. Go to **Settings → Branches**
2. Click **Edit** on the rule
3. Make changes
4. Click **Save changes**

---

## Best Practices

### Always use Pull Requests
```bash
git checkout -b feature/my-feature
# Make changes
git push origin feature/my-feature
# Open PR and wait for approval + checks
```

### Meaningful Commit Messages
```
feat: Add audio playback feature
fix: Resolve fretboard zoom issue  
test: Add snapshot tests
docs: Update README
refactor: Simplify chord calculation
```

### Feature Branch Naming
```
feature/add-snapshot-tests
bugfix/fix-audio-volume
hotfix/correct-note-display
test/improve-coverage
docs/update-readme
refactor/simplify-shapes
```

---

## Troubleshooting

### "Push rejected by branch protection"
This is expected! Use a PR instead:
```bash
git push origin feature/your-feature
# Create PR on GitHub
# Get approval
# Merge via UI
```

### "Status check failed"
Go to the PR and see which check failed:
- **Tests failed**: Run `npm test` locally and fix
- **Build failed**: Run `npm run build` locally and fix
- **Lint errors**: Run `npm run lint -- --fix` and commit

### "Need to merge urgently (emergency)"
1. Only admins can override
2. Ask repo maintainer
3. Must have documented reason
4. Still requires 1 approval minimum

---

## For Repository Admins

### Enable Auto-Merge (Optional)
1. Go to **Settings → General**
2. Check "Allow auto-merge"
3. Select default method: "Squash and merge"

This allows PR authors to enable auto-merge, which automatically merges when all checks pass.

### Enable Automatic Deletion
1. Go to **Settings → General**
2. Check "Automatically delete head branches"

This cleans up feature branches after merge.

---

## Exceptions & Overrides

Only repository admins can push directly to `main` if configured.

Exceptions should be documented:
- Create issue explaining why
- Link to emergency fix PR
- Post-incident: Review if process failed

---

## Related Documents

- [CICD.md](.github/CICD.md) - CI/CD Pipeline documentation
- [package.json](../package.json) - Test scripts
- [.github/workflows/](.github/workflows/) - Workflow configurations
