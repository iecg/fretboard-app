# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions to automate testing, linting, building, and deployment. The pipeline enforces code quality standards and prevents merging of code that doesn't meet requirements.

## Workflows

### 1. **CI Pipeline** (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
- **Tests** (Matrix: Node 18, 20)
  - Installs dependencies
  - Runs ESLint
  - Executes all tests with coverage
  - Uploads coverage to Codecov
  - Archives test results

- **Build**
  - Builds the production bundle
  - Archives dist folder

- **Quality Gate**
  - Validates all previous jobs passed
  - Posts summary comment on PRs

**Status**: Required to pass before merge

---

### 2. **Coverage Report** (`.github/workflows/coverage.yml`)

Generates detailed coverage reports and enforces minimum thresholds.

**Features:**
- Generates coverage in multiple formats (HTML, LCOV, JSON)
- Uploads to Codecov
- Comments coverage details on PRs
- Checks against minimum thresholds (70%)
- Archives coverage reports

**Minimum Coverage Thresholds:**
- Statements: 70%
- Branches: 65%
- Functions: 70%
- Lines: 70%

**Status**: Informational (doesn't block merge by default)

---

### 3. **PR Checks & Enforcement** (`.github/workflows/pr-checks.yml`)

Validates pull request changes and enforces quality standards.

**Checks:**
- Branch name validation (feature/*, bugfix/*, etc.)
- Commit message review
- Changed files analysis
- Test matrix verification
- PR validation comment

**Features:**
- Posts detailed PR status comment
- Tracks source files vs test files
- Warns if tests missing for source changes
- Sets GitHub commit status

**Status**: Required to pass before merge

---

## Running Tests Locally

### Run all tests once
```bash
npm test
```

### Run tests in watch mode
```bash
npm test:watch
```

### Generate coverage report
```bash
npm test:coverage
```

Coverage report will be available at `coverage/index.html`

---

## Coverage Goals

The project maintains minimum coverage thresholds to ensure code quality:

| Metric | Threshold |
|--------|-----------|
| Statements | 70% |
| Branches | 65% |
| Functions | 70% |
| Lines | 70% |

### Checking Current Coverage

```bash
npm run test:coverage
# Then open coverage/index.html in browser
```

---

## Branch Protection Rules

For the `main` branch, the following checks are required:

- ✅ CI / Tests (must pass)
- ✅ CI / Build (must pass)
- ✅ PR Checks / Enforce Quality Gates (must pass)
- ✅ Code Coverage (must improve or maintain)
- ✅ At least 1 approval (if configured)

These rules prevent merging of:
- PRs with failing tests
- Build failures
- Lint errors
- Coverage drops

---

## Artifacts & Reports

### Test Results
- **Storage**: 30 days
- **Location**: Actions → Artifacts
- **Contents**: Coverage reports, test results

### Build Artifacts
- **Storage**: 5 days
- **Location**: Actions → Artifacts
- **Contents**: `dist/` folder

### Coverage Reports
- **Storage**: 30 days
- **Formats**: HTML, LCOV, JSON
- **Codecov**: https://codecov.io (if configured)

---

## Debugging CI Failures

### Test Failures
1. Check the "Tests" job output
2. Look for specific test names that failed
3. Run `npm test -- --reporter=verbose` locally
4. Compare local vs CI environment

### Build Failures
1. Check the "Build" job output
2. Verify TypeScript types: `npm run build`
3. Check for missing dependencies

### Lint Failures
1. Run `npm run lint` locally
2. Fix issues: `npm run lint -- --fix`
3. Commit fixes

### Coverage Failures
1. Run `npm run test:coverage` locally
2. Open `coverage/index.html`
3. Identify uncovered lines
4. Add tests for those lines

---

## Configuration Files

### `vite.config.ts`
Contains vitest configuration including:
- Coverage provider (v8)
- Reporter formats
- Coverage thresholds
- Included/excluded files

### `package.json`
Scripts for testing:
- `npm test` - Run tests once
- `npm test:watch` - Run in watch mode
- `npm test:coverage` - Generate coverage

### `.github/workflows/ci.yml`
Main CI pipeline configuration

### `.github/workflows/coverage.yml`
Coverage reporting pipeline

### `.github/workflows/pr-checks.yml`
PR validation and enforcement

---

## Best Practices

### Before Pushing
```bash
npm run lint        # Check for lint errors
npm run test        # Run all tests
npm run build       # Verify build works
npm run test:coverage  # Check coverage
```

### Commit Messages
Use conventional commit format:
- `feat: Add new feature`
- `fix: Fix bug in component`
- `test: Add test for feature`
- `docs: Update documentation`
- `refactor: Refactor code structure`
- `chore: Update dependencies`

### Branch Names
Use descriptive names:
- `feature/add-snapshot-tests`
- `bugfix/fix-audio-playback`
- `test/improve-coverage`
- `docs/update-readme`

### PR Guidelines
1. Ensure all tests pass locally
2. Coverage doesn't decrease
3. No lint errors
4. Build succeeds
5. Add tests for new code
6. Update docs if needed

---

## Troubleshooting

### "Coverage below threshold"
- Run `npm run test:coverage` to see what's not covered
- Add tests for uncovered lines
- Check `coverage/index.html` for detailed report

### "Tests passing locally but failing in CI"
- Different Node version? (CI tests on 18 and 20)
- Environment variables? (Check .env setup)
- Cache issues? (Delete `node_modules` and `npm ci` again)

### "Build fails in CI but succeeds locally"
- TypeScript version difference?
- Missing dependencies? (Run `npm ci`)
- Check Node version: `node --version`

### "Lint passes locally but fails in CI"
- ESLint config mismatch? (Check `.eslintrc`)
- Run `npm run lint` to verify locally

---

## Monitoring

### GitHub Actions Dashboard
View all workflow runs: https://github.com/iecg/fretboard-app/actions

### Codecov Dashboard
View coverage trends: https://codecov.io (if configured)

### Status Badges
Add to README.md:
```markdown
[![CI](https://github.com/iecg/fretboard-app/actions/workflows/ci.yml/badge.svg)](https://github.com/iecg/fretboard-app/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/iecg/fretboard-app/branch/main/graph/badge.svg)](https://codecov.io/gh/iecg/fretboard-app)
```

---

## Contact & Support

For CI/CD issues:
1. Check the GitHub Actions logs
2. Review this documentation
3. Check the specific workflow file
4. Create an issue with detailed logs
