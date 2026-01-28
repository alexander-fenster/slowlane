# Claude Code Guidelines for Slowlane

## Build and Lint

- Compile: `npm run compile`
- Lint check: `npx gts check`
- Lint fix: `npx gts fix`

## Critical: No Mutating Commands

**NEVER automatically run any slowlane command that modifies App Store Connect state.**

This project works directly with production App Store Connect - there is no sandbox environment. Commands that read data (like `list-apps`, `show-metadata`) are safe to run. Commands that create, update, or delete anything must only be run manually by the user.

When implementing new commands:
- Read-only commands: safe to test automatically
- Mutating commands: show the user the command to run, but do not execute it

Examples of mutating operations (do not run automatically):
- Creating versions
- Updating metadata
- Uploading screenshots
- Submitting for review
