import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

// Config types
export interface AppStoreConnectConfig {
  issuer_id: string;
  key_id: string;
  private_key_path: string;
}

export interface SlowlaneConfig {
  appstore_connect: AppStoreConnectConfig;
}

// App Store Connect API response types
interface ResourceLinks {
  self: string;
}

interface PagedDocumentLinks {
  self: string;
  first?: string;
  next?: string;
}

interface PagingInformation {
  total: number;
  limit: number;
}

interface AppAttributes {
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
  isOrEverWasMadeForKids: boolean;
  subscriptionStatusUrl?: string;
  subscriptionStatusUrlVersion?: string;
  subscriptionStatusUrlForSandbox?: string;
  subscriptionStatusUrlVersionForSandbox?: string;
  contentRightsDeclaration?: string;
  streamlinedPurchasingEnabled: boolean;
}

interface AppRelationships {
  appStoreVersions?: {links: ResourceLinks};
  builds?: {links: ResourceLinks};
  betaAppLocalizations?: {links: ResourceLinks};
  betaGroups?: {links: ResourceLinks};
  preReleaseVersions?: {links: ResourceLinks};
}

export interface App {
  type: 'apps';
  id: string;
  attributes: AppAttributes;
  relationships?: AppRelationships;
  links: ResourceLinks;
}

interface AppsResponse {
  data: App[];
  links: PagedDocumentLinks;
  meta?: {paging: PagingInformation};
}

// App Info types
interface AppInfoAttributes {
  appStoreState: string;
  appStoreAgeRating?: string;
  brazilAgeRating?: string;
  brazilAgeRatingV2?: string;
  kidsAgeBand?: string;
  state: string;
}

interface AppInfo {
  type: 'appInfos';
  id: string;
  attributes: AppInfoAttributes;
  links: ResourceLinks;
}

interface AppInfosResponse {
  data: AppInfo[];
  links: PagedDocumentLinks;
}

// App Info Localization types
interface AppInfoLocalizationAttributes {
  locale: string;
  name?: string;
  subtitle?: string;
  privacyPolicyUrl?: string;
  privacyChoicesUrl?: string;
  privacyPolicyText?: string;
}

export interface AppInfoLocalization {
  type: 'appInfoLocalizations';
  id: string;
  attributes: AppInfoLocalizationAttributes;
  links: ResourceLinks;
}

interface AppInfoLocalizationsResponse {
  data: AppInfoLocalization[];
  links: PagedDocumentLinks;
}

// App Store Version Localization types (for description, keywords, etc.)
interface AppStoreVersionLocalizationAttributes {
  locale: string;
  description?: string;
  keywords?: string;
  marketingUrl?: string;
  promotionalText?: string;
  supportUrl?: string;
  whatsNew?: string;
}

export interface AppStoreVersionLocalization {
  type: 'appStoreVersionLocalizations';
  id: string;
  attributes: AppStoreVersionLocalizationAttributes;
  links: ResourceLinks;
}

interface AppStoreVersionLocalizationsResponse {
  data: AppStoreVersionLocalization[];
  links: PagedDocumentLinks;
}

// App Store Version types
interface AppStoreVersionAttributes {
  platform: string;
  versionString: string;
  appStoreState: string;
  appVersionState: string;
  copyright?: string;
  releaseType?: string;
  earliestReleaseDate?: string;
  downloadable: boolean;
  createdDate: string;
}

interface AppStoreVersion {
  type: 'appStoreVersions';
  id: string;
  attributes: AppStoreVersionAttributes;
  links: ResourceLinks;
}

interface AppStoreVersionsResponse {
  data: AppStoreVersion[];
  links: PagedDocumentLinks;
}

// Combined metadata for display
export interface AppMetadata {
  app: App;
  appInfo: AppInfo;
  latestVersion?: AppStoreVersion;
  localizations: LocalizedMetadata[];
}

export interface LocalizedMetadata {
  locale: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  promotionalText?: string;
  marketingUrl?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
}

// API Client
export class AppStoreConnectClient {
  private readonly issuerId: string;
  private readonly keyId: string;
  private readonly privateKey: string;
  private readonly baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  constructor(config: AppStoreConnectConfig, configDir: string) {
    this.issuerId = config.issuer_id;
    this.keyId = config.key_id;

    const keyPath = path.isAbsolute(config.private_key_path)
      ? config.private_key_path
      : path.join(configDir, config.private_key_path);

    this.privateKey = fs.readFileSync(keyPath, 'utf-8');
  }

  private generateToken(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.issuerId,
      iat: now,
      exp: now + 20 * 60, // 20 minutes
      aud: 'appstoreconnect-v1',
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'ES256',
      keyid: this.keyId,
    });
  }

  private async request<T>(endpoint: string): Promise<T> {
    const token = this.generateToken();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `App Store Connect API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }

  async listApps(): Promise<App[]> {
    const apps: App[] = [];
    let nextUrl: string | undefined = '/apps';

    while (nextUrl !== undefined) {
      const currentUrl: string = nextUrl;
      const endpoint: string = currentUrl.startsWith('http')
        ? currentUrl.replace(this.baseUrl, '')
        : currentUrl;

      const response: AppsResponse = await this.request<AppsResponse>(endpoint);
      apps.push(...response.data);

      nextUrl = response.links.next;
    }

    return apps;
  }

  async getAppByBundleId(bundleId: string): Promise<App | null> {
    const response = await this.request<AppsResponse>(
      `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`
    );
    return response.data[0] ?? null;
  }

  async getAppMetadata(bundleId: string): Promise<AppMetadata> {
    const app = await this.getAppByBundleId(bundleId);
    if (!app) {
      throw new Error(`App not found with bundle ID: ${bundleId}`);
    }

    // Get app infos (contains state and age rating info)
    const appInfosResponse = await this.request<AppInfosResponse>(
      `/apps/${app.id}/appInfos`
    );
    const appInfo = appInfosResponse.data[0];
    if (!appInfo) {
      throw new Error(`No app info found for app: ${bundleId}`);
    }

    // Get app info localizations (name, subtitle, privacy policy)
    const appInfoLocalizationsResponse =
      await this.request<AppInfoLocalizationsResponse>(
        `/appInfos/${appInfo.id}/appInfoLocalizations`
      );

    // Get latest app store version for each platform
    const versionsResponse = await this.request<AppStoreVersionsResponse>(
      `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=1`
    );
    const latestVersion = versionsResponse.data[0];

    // Get version localizations (description, keywords, what's new)
    let versionLocalizations: AppStoreVersionLocalization[] = [];
    if (latestVersion) {
      const versionLocalizationsResponse =
        await this.request<AppStoreVersionLocalizationsResponse>(
          `/appStoreVersions/${latestVersion.id}/appStoreVersionLocalizations`
        );
      versionLocalizations = versionLocalizationsResponse.data;
    }

    // Merge localizations by locale
    const localeMap = new Map<string, LocalizedMetadata>();

    for (const loc of appInfoLocalizationsResponse.data) {
      const locale = loc.attributes.locale;
      localeMap.set(locale, {
        locale,
        name: loc.attributes.name,
        subtitle: loc.attributes.subtitle,
        privacyPolicyUrl: loc.attributes.privacyPolicyUrl,
      });
    }

    for (const loc of versionLocalizations) {
      const locale = loc.attributes.locale;
      const existing = localeMap.get(locale) ?? {locale};
      localeMap.set(locale, {
        ...existing,
        description: loc.attributes.description,
        keywords: loc.attributes.keywords,
        whatsNew: loc.attributes.whatsNew,
        promotionalText: loc.attributes.promotionalText,
        marketingUrl: loc.attributes.marketingUrl,
        supportUrl: loc.attributes.supportUrl,
      });
    }

    const localizations = Array.from(localeMap.values()).sort((a, b) =>
      a.locale.localeCompare(b.locale)
    );

    return {
      app,
      appInfo,
      latestVersion,
      localizations,
    };
  }
}
