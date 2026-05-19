# Contributing to OpenBench

Thank you for considering contributing to OpenBench! We welcome contributions from the community.

## How to Contribute

### Reporting Issues
- Use the [GitHub Issues](https://github.com/theoslater/openbench/issues) to report bugs or request features.
- Please include:
  - Clear description of the issue
  - Steps to reproduce (for bugs)
  - Expected vs actual behavior
  - Screenshots or logs if applicable
  - Environment details (OS, Tauri version, etc.)

### Suggesting Features
- Open an issue with the feature request
- Describe the use case and expected benefits
- Consider providing mockups or examples if helpful

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/openbench.git
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Ensure you have the Tauri prerequisites installed for your platform
5. Start the development server:
   ```bash
   bun run tauri dev
   ```

## Coding Standards

- Follow the existing code style in the repository
- TypeScript Strict mode is enabled; ensure new code passes type checking
- React components should be functional components with hooks
- State management should use Zustand stores
- Tailwind CSS classes should be used for styling; avoid inline styles
- Commit messages should be clear and descriptive
- Pull requests should target the `main` branch

## Pull Request Process

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes and commit with a clear message
3. Push to your fork and open a pull request
4. Ensure your PR includes:
   - Description of changes
   - Related issue number (if applicable)
   - Screenshots or demo for UI changes
   - Any necessary database migrations
5. Maintainers will review and provide feedback
6. Once approved, maintainers will merge the PR

## Testing Guidelines

- Test new features thoroughly before submitting
- Ensure existing functionality is not broken
- For UI changes, test on different screen sizes if applicable
- Test both light and dark themes
- Verify that authentication and session management work correctly
- Test with different AI providers if your changes affect provider integration

## Documentation

- Update the README.md if your changes affect usage or setup
- Add JSDoc comments for new public functions and types
- Update the CONTRIBUTING.md if you change the contribution process

## Database Migrations

- If your changes require database schema changes, add a new migration file in `src-tauri/src/db/migrations/`
- Follow the naming convention: `YYYYMMDDHHMMSS_description.sql`
- Ensure migrations are backward compatible where possible

## Reporting Security Issues

- Please do not report security vulnerabilities through public GitHub issues
- Contact the maintainers directly through GitHub security advisories

## Community

- Be respectful and constructive in all interactions
- Follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/0/code_of_conduct/) Code of Conduct
- Help others in the community when possible

Thank you for contributing to OpenBench!
