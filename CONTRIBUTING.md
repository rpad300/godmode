# Contributing to GodMode

Thank you for your interest in contributing to GodMode! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/godmode.git
   cd godmode
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/godmode.git
   ```

## Development Setup

### Prerequisites

- Node.js v18 or later
- npm v9 or later
- Git
- Ollama (optional, for local AI features)

### Quick Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Build frontend
npm run build:frontend

# Start in development mode
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-export-to-csv` - New features
- `fix/login-redirect-loop` - Bug fixes
- `docs/update-api-reference` - Documentation
- `refactor/simplify-auth-flow` - Code refactoring
- `test/add-billing-tests` - Test additions

### Commit Messages

Follow conventional commits format:

```
type(scope): short description

Longer description if needed.

Fixes #123
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

Examples:
```
feat(api): add export to CSV endpoint
fix(auth): resolve session timeout on mobile
docs(readme): add Docker setup instructions
test(billing): add subscription renewal tests
```

## Pull Request Process

1. **Create a new branch** from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Ensure tests pass**:
   ```bash
   npm test
   ```

4. **Update documentation** if needed

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** with:
   - Clear title describing the change
   - Description of what and why
   - Link to related issue(s)
   - Screenshots for UI changes

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows project style
- [ ] Documentation updated (if applicable)
- [ ] No sensitive data or API keys committed
- [ ] Commits are clean and descriptive

## Code Style

### JavaScript/Node.js

- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use async/await over callbacks
- Add JSDoc comments for public functions
- Maximum line length: 120 characters

```javascript
/**
 * Process a document and extract knowledge
 * @param {string} documentId - The document identifier
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Extracted knowledge
 */
async function processDocument(documentId, options = {}) {
    const document = await loadDocument(documentId);
    // ...
}
```

### TypeScript (Frontend)

- Use strict TypeScript
- Define proper interfaces/types
- Avoid `any` type when possible

```typescript
interface ProcessingResult {
    facts: Fact[];
    decisions: Decision[];
    questions: Question[];
}

async function extractKnowledge(content: string): Promise<ProcessingResult> {
    // ...
}
```

### CSS

- Use CSS variables for theming
- Follow BEM naming convention
- Mobile-first responsive design

```css
/* Component: .card */
.card {
    background: var(--bg-primary);
    border-radius: var(--radius-md);
}

.card__header {
    padding: var(--spacing-md);
}

.card--highlighted {
    border: 2px solid var(--color-accent);
}
```

## Testing

### Unit Tests

Located in `tests/unit/`. Test individual functions and modules.

```javascript
describe('auth', () => {
    it('should validate token correctly', async () => {
        const token = createTestToken({ userId: '123' });
        const result = await validateToken(token);
        expect(result.valid).toBe(true);
    });
});
```

### Integration Tests

Located in `tests/integration/`. Test API endpoints and workflows.

```javascript
describe('API: Projects', () => {
    it('should create a new project', async () => {
        const response = await request(app)
            .post('/api/projects')
            .send({ name: 'Test Project' });
        
        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Test Project');
    });
});
```

## Documentation

### Code Comments

- Comment the "why", not the "what"
- Use JSDoc for public APIs
- Keep comments up to date with code changes

### README Updates

If your change affects:
- Installation process
- Configuration options
- API endpoints
- User-facing features

Please update the relevant sections in README.md.

### API Documentation

For new API endpoints, update `docs/api/openapi.yaml` with:
- Endpoint path and method
- Request/response schemas
- Example payloads

## Questions?

If you have questions about contributing:

1. Check existing issues and discussions
2. Open a new issue with the "question" label
3. Be specific about what you're trying to accomplish

Thank you for contributing to GodMode!
