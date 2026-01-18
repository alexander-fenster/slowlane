import {App, AppMetadata, LocalizedMetadata} from './appstoreconnect.js';

export interface OutputOptions {
  json?: boolean;
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export interface AppListOutput {
  name: string;
  bundleId: string;
  sku: string;
  id: string;
}

export function outputAppList(apps: App[], options: OutputOptions): void {
  const data: AppListOutput[] = apps.map(app => ({
    name: app.attributes.name,
    bundleId: app.attributes.bundleId,
    sku: app.attributes.sku,
    id: app.id,
  }));

  if (options.json) {
    outputJson(data);
    return;
  }

  console.log(`Found ${apps.length} app(s):\n`);
  for (const app of data) {
    console.log(`  ${app.name}`);
    console.log(`    Bundle ID: ${app.bundleId}`);
    console.log(`    SKU: ${app.sku}`);
    console.log(`    ID: ${app.id}`);
    console.log();
  }
}

export interface MetadataOutput {
  name: string;
  bundleId: string;
  primaryLocale: string;
  state: string;
  latestVersion?: string;
  localizations: LocalizedMetadata[];
}

export function outputMetadata(
  metadata: AppMetadata,
  locale: string | undefined,
  options: OutputOptions
): void {
  const showFull = !!locale;
  const localizations = locale
    ? metadata.localizations.filter(l => l.locale === locale)
    : metadata.localizations;

  if (locale && localizations.length === 0) {
    const error = {
      error: 'Locale not found',
      locale,
      availableLocales: metadata.localizations.map(l => l.locale),
    };
    if (options.json) {
      outputJson(error);
    } else {
      console.error(`Locale not found: ${locale}`);
      console.log(
        `Available locales: ${metadata.localizations.map(l => l.locale).join(', ')}`
      );
    }
    process.exit(1);
  }

  const data: MetadataOutput = {
    name: metadata.app.attributes.name,
    bundleId: metadata.app.attributes.bundleId,
    primaryLocale: metadata.app.attributes.primaryLocale,
    state: metadata.appInfo.attributes.appStoreState,
    latestVersion: metadata.latestVersion?.attributes.versionString,
    localizations,
  };

  if (options.json) {
    outputJson(data);
    return;
  }

  console.log(`App: ${data.name}`);
  console.log(`Bundle ID: ${data.bundleId}`);
  console.log(`Primary Locale: ${data.primaryLocale}`);
  console.log(`State: ${data.state}`);
  if (data.latestVersion) {
    console.log(`Latest Version: ${data.latestVersion}`);
  }
  console.log();

  for (const loc of localizations) {
    console.log(`--- ${loc.locale} ---`);
    if (loc.name) console.log(`Name: ${loc.name}`);
    if (loc.subtitle) console.log(`Subtitle: ${loc.subtitle}`);
    if (loc.description) {
      if (showFull) {
        console.log(`Description:\n${loc.description}`);
      } else {
        const truncated =
          loc.description.length > 200
            ? loc.description.substring(0, 200) + '...'
            : loc.description;
        console.log(`Description: ${truncated}`);
      }
    }
    if (loc.keywords) console.log(`Keywords: ${loc.keywords}`);
    if (loc.whatsNew) {
      if (showFull) {
        console.log(`What's New:\n${loc.whatsNew}`);
      } else {
        const truncated =
          loc.whatsNew.length > 100
            ? loc.whatsNew.substring(0, 100) + '...'
            : loc.whatsNew;
        console.log(`What's New: ${truncated}`);
      }
    }
    if (loc.promotionalText)
      console.log(`Promotional Text: ${loc.promotionalText}`);
    if (loc.supportUrl) console.log(`Support URL: ${loc.supportUrl}`);
    if (loc.marketingUrl) console.log(`Marketing URL: ${loc.marketingUrl}`);
    if (loc.privacyPolicyUrl)
      console.log(`Privacy Policy URL: ${loc.privacyPolicyUrl}`);
    console.log();
  }
}
