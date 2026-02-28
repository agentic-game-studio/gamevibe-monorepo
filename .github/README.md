# GitHub Workflows and Automation

This directory contains GitHub Actions workflows and configuration files for GameVibe AI's CI/CD pipeline.

## Workflows

### Core Workflows

#### 1. **CI Workflow** (`ci.yml`)
- **Triggers**: Push to main/develop, Pull requests
- **Jobs**:
  - Lint and type check
  - Run tests with PostgreSQL and Redis
  - Build application
  - Build Docker images
  - Security scanning with Trivy
  - Dependency review for PRs
- **Purpose**: Ensure code quality and catch issues early

#### 2. **Deploy Workflow** (`deploy.yml`)
- **Triggers**: Push to main, Manual dispatch
- **Jobs**:
  - Build and push Docker images
  - Deploy to production/staging
  - Run database migrations
  - Health checks
  - Rollback on failure
- **Purpose**: Automated deployment with safety checks

#### 3. **Release Workflow** (`release.yml`)
- **Triggers**: Version tags (v*), Manual dispatch
- **Jobs**:
  - Generate changelog
  - Create GitHub release
  - Build and publish Docker images
  - Deploy to production
- **Purpose**: Automated releases with proper versioning

### Maintenance Workflows

#### 4. **Scheduled Tests** (`scheduled-tests.yml`)
- **Triggers**: Daily at 2 AM UTC, Manual dispatch
- **Jobs**:
  - Integration tests
  - E2E tests against production
  - Performance tests with Lighthouse
  - Security audit
- **Purpose**: Continuous monitoring of production health

#### 5. **PR Automation** (`pr-automation.yml`)
- **Triggers**: PR events, Comments
- **Jobs**:
  - Auto-label PRs based on files changed
  - Add size labels
  - Validate PR titles (semantic commits)
  - Auto-assign reviewers
  - Handle slash commands
  - Check for merge conflicts
- **Purpose**: Streamline PR workflow

## Configuration Files

### 1. **Labeler** (`.github/labeler.yml`)
Automatically adds labels to PRs based on file changes:
- `bot`, `ai-service`, `web-runtime`, etc. for package changes
- `documentation` for markdown files
- `dependencies` for package.json changes
- `tests` for test file changes

### 2. **Auto Assign** (`.github/auto-assign.yml`)
Configuration for automatically assigning reviewers:
- Adds reviewers from specific groups (frontend, backend, ai)
- Respects CODEOWNERS file
- Skips WIP/draft PRs

### 3. **Changelog Config** (`.github/changelog-config.json`)
Defines how to generate changelogs for releases:
- Categories for different types of changes
- PR template format
- Label extraction patterns

### 4. **CODEOWNERS** (`.github/CODEOWNERS`)
Defines code ownership for automatic reviewer assignment:
- Package-specific owners
- Security-sensitive file owners
- Documentation owners

### 5. **Dependabot** (`.github/dependabot.yml`)
Automated dependency updates:
- Weekly updates for npm, Docker, and GitHub Actions
- Grouped updates for related dependencies
- Custom configuration per package

## Required Secrets

To use these workflows, configure the following secrets in your repository:

### Essential Secrets
- `DOCKERHUB_USERNAME` - Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token
- `DISCORD_WEBHOOK` - Discord webhook URL for notifications

### Deployment Secrets
- `PRODUCTION_HOST` - Production server hostname
- `PRODUCTION_USER` - SSH username for production
- `PRODUCTION_SSH_KEY` - SSH private key for production
- `PRODUCTION_URL` - Production URL for health checks
- `STAGING_HOST` - Staging server hostname (optional)
- `STAGING_USER` - SSH username for staging (optional)
- `STAGING_SSH_KEY` - SSH private key for staging (optional)
- `STAGING_URL` - Staging URL for health checks (optional)

### Optional Secrets
- `NPM_TOKEN` - NPM token for publishing packages
- `SLACK_WEBHOOK` - Slack webhook for notifications

## Environment Protection Rules

### Production Environment
- Required reviewers for deployment
- Deployment only from main branch
- Wait timer before deployment (optional)

### Staging Environment
- Less restrictive than production
- Used for testing releases

## Usage

### Manual Deployment
```bash
# Deploy to production
gh workflow run deploy.yml

# Deploy to staging
gh workflow run deploy.yml -f environment=staging
```

### Create Release
```bash
# Create release from tag
git tag v1.0.0
git push origin v1.0.0

# Or manually
gh workflow run release.yml -f version=v1.0.0
```

### Run Tests
```bash
# Run scheduled tests manually
gh workflow run scheduled-tests.yml
```

## Best Practices

1. **Semantic Commits**: Use conventional commit format (feat:, fix:, etc.)
2. **PR Titles**: Must follow semantic format for changelog generation
3. **Labels**: Let automation handle labels, don't add manually
4. **Reviews**: Wait for automated checks before reviewing
5. **Deployments**: Always deploy through GitHub Actions, not manually

## Monitoring

- Check Actions tab for workflow runs
- Discord/Slack notifications for important events
- Dependabot dashboard for dependency updates
- Security tab for vulnerability alerts

## Troubleshooting

### Common Issues

1. **Docker build fails**: Check Dockerfile syntax and base image availability
2. **Tests fail**: Ensure test databases are properly configured
3. **Deployment fails**: Verify SSH keys and server connectivity
4. **PR checks fail**: Fix linting/type errors before pushing

### Debug Commands

```bash
# Test workflow syntax
act -l

# Run workflow locally (requires act)
act push -W .github/workflows/ci.yml

# Validate workflow files
actionlint .github/workflows/*.yml
```