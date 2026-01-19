# slowlane

A simple CLI for managing App Store and Google Play metadata.

Fastlane is powerful but complex to set up. Slowlane focuses on one thing: making it easy to update localized metadata (titles, descriptions, keywords) across multiple languages. Screenshots, builds, and submitting for review are left to the respective console UIs.

## Setup

### Apple App Store Connect

1. Go to [App Store Connect > Users and Access > Integrations > App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Generate a new API key with "App Manager" role
3. Download the `.p8` private key file
4. Note the Key ID and Issuer ID

### Google Play Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable both APIs:
   - **Google Play Developer Reporting API** (for listing apps)
   - **Google Play Android Developer API** (for metadata operations)
4. Create a Service Account with a JSON key
5. In Google Play Console, go to Users and Permissions, invite your service account email, and grant "Manage store presence" and "Releases" permissions

### Configuration

Create `slowlane.toml` in your project directory:

```toml
[appstore_connect]
issuer_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
key_id = "XXXXXXXXXX"
private_key_path = "./AuthKey_XXXXXXXXXX.p8"

[google_play]
service_account_path = "./your-service-account.json"
```

Add sensitive files to `.gitignore`:

```
slowlane.toml
*.p8
*-service-account.json
```

## Usage

### Apple App Store Connect

```bash
# List all apps
npx slowlane apple list-apps

# List supported locales
npx slowlane apple list-locales
npx slowlane apple list-locales --json

# View metadata for all languages (from editable version)
npx slowlane apple get-metadata com.example.app

# View full metadata for a specific language
npx slowlane apple get-metadata com.example.app en-US

# Save metadata from live version to JSON
npx slowlane apple get-metadata com.example.app --from live --json > metadata.json

# Create a new version
npx slowlane apple create-version com.example.app 2.0.0

# Update metadata from JSON file
npx slowlane apple set-metadata com.example.app -f metadata.json
```

### Google Play

```bash
# List all apps
npx slowlane google list-apps

# List supported locales
npx slowlane google list-locales
npx slowlane google list-locales --json

# View metadata for all languages
npx slowlane google get-metadata com.example.app

# View full metadata for a specific language
npx slowlane google get-metadata com.example.app en-US

# Save metadata to JSON
npx slowlane google get-metadata com.example.app --json > metadata.json

# Update metadata from JSON (changes are sent for review automatically)
npx slowlane google set-metadata com.example.app -f metadata.json
```

## Typical Workflow

1. **Export current metadata** from the live version as a starting point
2. **Edit the JSON** file to update descriptions, keywords, etc. Use ChatGPT as needed to add translations to new locales. The list of locales supported by Apple and Google can be retrieved by `slowlane apple list-locales` and `slowlane google list-locales`.
3. **Create a new version** (Apple only - Google doesn't require this for metadata)
4. **Import the updated metadata** from the JSON file
5. **Review and submit** in the respective console UI

## Author

Alexander Fenster, slowlane@fenster.name

100% vibe coded with [Claude Code](https://claude.ai/code)

<a href="https://buymeacoffee.com/alexander.fenster"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40"></a>
