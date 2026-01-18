import {
  App,
  AppMetadata,
  AppStoreVersion,
  LocalizedMetadata,
  Platform,
  SetMetadataResult,
} from './appstoreconnect.js';
import {GooglePlayApp} from './googleplay.js';

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

export interface VersionInfo {
  versionString: string;
  state: string;
}

export interface MetadataOutput {
  name: string;
  bundleId: string;
  primaryLocale: string;
  liveVersion?: VersionInfo;
  editableVersion?: VersionInfo;
  localizationsFrom: 'live' | 'editable';
  localizations: LocalizedMetadata[];
}

export function outputMetadata(
  metadata: AppMetadata,
  locale: string | undefined,
  from: 'live' | 'editable' = 'editable',
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

  // Determine which version localizations actually came from
  const actualFrom =
    from === 'live'
      ? metadata.liveVersion
        ? 'live'
        : 'editable'
      : metadata.editableVersion
        ? 'editable'
        : 'live';

  const data: MetadataOutput = {
    name: metadata.app.attributes.name,
    bundleId: metadata.app.attributes.bundleId,
    primaryLocale: metadata.app.attributes.primaryLocale,
    liveVersion: metadata.liveVersion
      ? {
          versionString: metadata.liveVersion.attributes.versionString,
          state: metadata.liveVersion.attributes.appStoreState,
        }
      : undefined,
    editableVersion: metadata.editableVersion
      ? {
          versionString: metadata.editableVersion.attributes.versionString,
          state: metadata.editableVersion.attributes.appStoreState,
        }
      : undefined,
    localizationsFrom: actualFrom,
    localizations,
  };

  if (options.json) {
    outputJson(data);
    return;
  }

  console.log(`App: ${data.name}`);
  console.log(`Bundle ID: ${data.bundleId}`);
  console.log(`Primary Locale: ${data.primaryLocale}`);
  if (data.liveVersion) {
    console.log(
      `Live Version: ${data.liveVersion.versionString} (${data.liveVersion.state})`
    );
  }
  if (data.editableVersion) {
    console.log(
      `Editable Version: ${data.editableVersion.versionString} (${data.editableVersion.state})`
    );
  }
  console.log(`Showing localizations from: ${data.localizationsFrom} version`);
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

export interface VersionOutput {
  id: string;
  versionString: string;
  platform: Platform;
  state: string;
  createdDate: string;
}

export function outputVersion(
  version: AppStoreVersion,
  options: OutputOptions
): void {
  const data: VersionOutput = {
    id: version.id,
    versionString: version.attributes.versionString,
    platform: version.attributes.platform,
    state: version.attributes.appStoreState,
    createdDate: version.attributes.createdDate,
  };

  if (options.json) {
    outputJson(data);
    return;
  }

  console.log(`Created version ${data.versionString}`);
  console.log(`  ID: ${data.id}`);
  console.log(`  Platform: ${data.platform}`);
  console.log(`  State: ${data.state}`);
  console.log(`  Created: ${data.createdDate}`);
}

export function outputSetMetadataResult(
  result: SetMetadataResult,
  options: OutputOptions
): void {
  if (options.json) {
    outputJson(result);
    return;
  }

  const total =
    result.appInfoLocalizationsUpdated.length +
    result.appInfoLocalizationsCreated.length +
    result.versionLocalizationsUpdated.length +
    result.versionLocalizationsCreated.length;

  if (total === 0) {
    console.log('No changes made.');
    return;
  }

  console.log('Metadata updated successfully:\n');

  if (result.appInfoLocalizationsUpdated.length > 0) {
    console.log(
      `  App info localizations updated: ${result.appInfoLocalizationsUpdated.join(', ')}`
    );
  }
  if (result.appInfoLocalizationsCreated.length > 0) {
    console.log(
      `  App info localizations created: ${result.appInfoLocalizationsCreated.join(', ')}`
    );
  }
  if (result.versionLocalizationsUpdated.length > 0) {
    console.log(
      `  Version localizations updated: ${result.versionLocalizationsUpdated.join(', ')}`
    );
  }
  if (result.versionLocalizationsCreated.length > 0) {
    console.log(
      `  Version localizations created: ${result.versionLocalizationsCreated.join(', ')}`
    );
  }
}

export function outputGooglePlayAppList(
  apps: GooglePlayApp[],
  options: OutputOptions
): void {
  if (options.json) {
    outputJson(apps);
    return;
  }

  console.log(`Found ${apps.length} app(s):\n`);
  for (const app of apps) {
    console.log(`  ${app.displayName}`);
    console.log(`    Package: ${app.packageName}`);
    console.log();
  }
}
