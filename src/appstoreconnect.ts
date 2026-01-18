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
export type Platform = 'IOS' | 'MAC_OS' | 'TV_OS' | 'VISION_OS';

interface AppStoreVersionAttributes {
  platform: Platform;
  versionString: string;
  appStoreState: string;
  appVersionState: string;
  copyright?: string;
  releaseType?: string;
  earliestReleaseDate?: string;
  downloadable: boolean;
  createdDate: string;
}

export interface AppStoreVersion {
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
  liveVersion?: AppStoreVersion;
  editableVersion?: AppStoreVersion;
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

  private async request<T>(
    endpoint: string,
    options?: {method?: string; body?: unknown}
  ): Promise<T> {
    const token = this.generateToken();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
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

  async getAppMetadata(
    bundleId: string,
    fromVersion: 'live' | 'editable' = 'editable'
  ): Promise<AppMetadata> {
    const app = await this.getAppByBundleId(bundleId);
    if (!app) {
      throw new Error(`App not found with bundle ID: ${bundleId}`);
    }

    // Get app infos (contains state and age rating info)
    const appInfosResponse = await this.request<AppInfosResponse>(
      `/apps/${app.id}/appInfos`
    );
    // Find live and editable appInfos
    const liveAppInfo = appInfosResponse.data.find(
      info => info.attributes.appStoreState === 'READY_FOR_SALE'
    );
    const editableAppInfo = appInfosResponse.data.find(
      info => info.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const appInfo =
      fromVersion === 'live'
        ? (liveAppInfo ?? editableAppInfo)
        : (editableAppInfo ?? liveAppInfo);
    if (!appInfo) {
      throw new Error(`No app info found for app: ${bundleId}`);
    }

    // Get app info localizations (name, subtitle, privacy policy)
    const appInfoLocalizationsResponse =
      await this.request<AppInfoLocalizationsResponse>(
        `/appInfos/${appInfo.id}/appInfoLocalizations?limit=200`
      );

    // Get app store versions to find live and editable versions
    const versionsResponse = await this.request<AppStoreVersionsResponse>(
      `/apps/${app.id}/appStoreVersions?limit=10`
    );

    // Find live version (READY_FOR_SALE) and editable version (PREPARE_FOR_SUBMISSION, etc.)
    const liveVersion = versionsResponse.data.find(
      v => v.attributes.appStoreState === 'READY_FOR_SALE'
    );
    const editableVersion = versionsResponse.data.find(v =>
      [
        'PREPARE_FOR_SUBMISSION',
        'WAITING_FOR_REVIEW',
        'IN_REVIEW',
        'PENDING_DEVELOPER_RELEASE',
      ].includes(v.attributes.appStoreState)
    );

    // Get version localizations from the requested version
    const versionForLocalizations =
      fromVersion === 'live'
        ? (liveVersion ?? editableVersion)
        : (editableVersion ?? liveVersion);
    let versionLocalizations: AppStoreVersionLocalization[] = [];
    if (versionForLocalizations) {
      const versionLocalizationsResponse =
        await this.request<AppStoreVersionLocalizationsResponse>(
          `/appStoreVersions/${versionForLocalizations.id}/appStoreVersionLocalizations`
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
      liveVersion,
      editableVersion,
      localizations,
    };
  }

  async getLatestVersion(bundleId: string): Promise<AppStoreVersion | null> {
    const app = await this.getAppByBundleId(bundleId);
    if (!app) {
      throw new Error(`App not found with bundle ID: ${bundleId}`);
    }

    // Get most recent version (sorted by createdDate desc by default)
    const response = await this.request<AppStoreVersionsResponse>(
      `/apps/${app.id}/appStoreVersions?limit=1`
    );

    return response.data[0] ?? null;
  }

  async createVersion(
    bundleId: string,
    versionString: string,
    platform?: Platform
  ): Promise<AppStoreVersion> {
    const app = await this.getAppByBundleId(bundleId);
    if (!app) {
      throw new Error(`App not found with bundle ID: ${bundleId}`);
    }

    // If no platform specified, copy from latest version
    let targetPlatform: Platform = platform ?? 'IOS';
    if (!platform) {
      const latestVersion = await this.getLatestVersion(bundleId);
      if (latestVersion) {
        targetPlatform = latestVersion.attributes.platform;
      }
    }

    const body = {
      data: {
        type: 'appStoreVersions',
        attributes: {
          platform: targetPlatform,
          versionString,
        },
        relationships: {
          app: {
            data: {type: 'apps', id: app.id},
          },
        },
      },
    };

    const response = await this.request<{data: AppStoreVersion}>(
      '/appStoreVersions',
      {method: 'POST', body}
    );

    return response.data;
  }

  async setMetadata(
    bundleId: string,
    localizations: LocalizedMetadata[]
  ): Promise<SetMetadataResult> {
    // Validate field lengths before making any API calls
    const validationErrors: string[] = [];
    for (const loc of localizations) {
      if (loc.name && loc.name.length > 30) {
        validationErrors.push(
          `${loc.locale}: name exceeds 30 characters (${loc.name.length})`
        );
      }
      if (loc.subtitle && loc.subtitle.length > 30) {
        validationErrors.push(
          `${loc.locale}: subtitle exceeds 30 characters (${loc.subtitle.length})`
        );
      }
      if (loc.keywords && loc.keywords.length > 100) {
        validationErrors.push(
          `${loc.locale}: keywords exceeds 100 characters (${loc.keywords.length})`
        );
      }
    }
    if (validationErrors.length > 0) {
      throw new Error(
        `Validation failed:\n  ${validationErrors.join('\n  ')}`
      );
    }

    const app = await this.getAppByBundleId(bundleId);
    if (!app) {
      throw new Error(`App not found with bundle ID: ${bundleId}`);
    }

    // Get app info for app-level localizations - find the editable one
    const appInfosResponse = await this.request<AppInfosResponse>(
      `/apps/${app.id}/appInfos`
    );
    // Find editable appInfo (not READY_FOR_SALE)
    const editableAppInfo = appInfosResponse.data.find(
      info => info.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    if (!editableAppInfo) {
      throw new Error(
        'No editable app info found. Create a new version first with create-version.'
      );
    }
    const appInfo = editableAppInfo;

    // Get existing app info localizations (limit=200 to avoid pagination issues)
    const appInfoLocResponse = await this.request<AppInfoLocalizationsResponse>(
      `/appInfos/${appInfo.id}/appInfoLocalizations?limit=200`
    );
    const existingAppInfoLocs = new Map(
      appInfoLocResponse.data.map(l => [l.attributes.locale, l])
    );

    // Get editable version for version-level localizations
    const versionsResponse = await this.request<AppStoreVersionsResponse>(
      `/apps/${app.id}/appStoreVersions?limit=10`
    );
    const editableVersion = versionsResponse.data.find(v =>
      [
        'PREPARE_FOR_SUBMISSION',
        'WAITING_FOR_REVIEW',
        'IN_REVIEW',
        'PENDING_DEVELOPER_RELEASE',
      ].includes(v.attributes.appStoreState)
    );

    if (!editableVersion) {
      throw new Error(
        'No editable version found. Create a new version first with create-version.'
      );
    }

    // Get existing version localizations (limit=200 to avoid pagination issues)
    const versionLocResponse =
      await this.request<AppStoreVersionLocalizationsResponse>(
        `/appStoreVersions/${editableVersion.id}/appStoreVersionLocalizations?limit=200`
      );
    const existingVersionLocs = new Map(
      versionLocResponse.data.map(l => [l.attributes.locale, l])
    );

    const results: SetMetadataResult = {
      appInfoLocalizationsUpdated: [],
      appInfoLocalizationsCreated: [],
      versionLocalizationsUpdated: [],
      versionLocalizationsCreated: [],
    };

    for (const loc of localizations) {
      // Update or create app info localization (name, subtitle, privacyPolicyUrl)
      const appInfoAttrs: Record<string, string | null> = {};
      if ('name' in loc) appInfoAttrs.name = loc.name ?? null;
      if ('subtitle' in loc) appInfoAttrs.subtitle = loc.subtitle ?? null;
      if ('privacyPolicyUrl' in loc)
        appInfoAttrs.privacyPolicyUrl = loc.privacyPolicyUrl ?? null;

      const hasAppInfoFields = Object.keys(appInfoAttrs).length > 0;
      if (hasAppInfoFields) {
        const existingAppInfoLoc = existingAppInfoLocs.get(loc.locale);

        if (existingAppInfoLoc) {
          await this.request(`/appInfoLocalizations/${existingAppInfoLoc.id}`, {
            method: 'PATCH',
            body: {
              data: {
                type: 'appInfoLocalizations',
                id: existingAppInfoLoc.id,
                attributes: appInfoAttrs,
              },
            },
          });
          results.appInfoLocalizationsUpdated.push(loc.locale);
        } else {
          // Try to create, but handle duplicate error by falling back to PATCH
          try {
            await this.request('/appInfoLocalizations', {
              method: 'POST',
              body: {
                data: {
                  type: 'appInfoLocalizations',
                  attributes: {locale: loc.locale, ...appInfoAttrs},
                  relationships: {
                    appInfo: {data: {type: 'appInfos', id: appInfo.id}},
                  },
                },
              },
            });
            results.appInfoLocalizationsCreated.push(loc.locale);
          } catch (error) {
            // If duplicate error, fetch and PATCH instead
            if (
              error instanceof Error &&
              error.message.includes('DUPLICATE')
            ) {
              const refetch = await this.request<AppInfoLocalizationsResponse>(
                `/appInfos/${appInfo.id}/appInfoLocalizations?filter[locale]=${loc.locale}`
              );
              const existing = refetch.data[0];
              if (existing) {
                await this.request(`/appInfoLocalizations/${existing.id}`, {
                  method: 'PATCH',
                  body: {
                    data: {
                      type: 'appInfoLocalizations',
                      id: existing.id,
                      attributes: appInfoAttrs,
                    },
                  },
                });
                results.appInfoLocalizationsUpdated.push(loc.locale);
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
      }

      // Update or create version localization
      const versionAttrs: Record<string, string | null> = {};
      if ('description' in loc) versionAttrs.description = loc.description ?? null;
      if ('keywords' in loc) versionAttrs.keywords = loc.keywords ?? null;
      if ('whatsNew' in loc) versionAttrs.whatsNew = loc.whatsNew ?? null;
      if ('promotionalText' in loc)
        versionAttrs.promotionalText = loc.promotionalText ?? null;
      if ('marketingUrl' in loc) versionAttrs.marketingUrl = loc.marketingUrl ?? null;
      if ('supportUrl' in loc) versionAttrs.supportUrl = loc.supportUrl ?? null;

      const hasVersionFields = Object.keys(versionAttrs).length > 0;
      if (hasVersionFields) {
        const existingVersionLoc = existingVersionLocs.get(loc.locale);

        if (existingVersionLoc) {
          await this.request(
            `/appStoreVersionLocalizations/${existingVersionLoc.id}`,
            {
              method: 'PATCH',
              body: {
                data: {
                  type: 'appStoreVersionLocalizations',
                  id: existingVersionLoc.id,
                  attributes: versionAttrs,
                },
              },
            }
          );
          results.versionLocalizationsUpdated.push(loc.locale);
        } else {
          // Try to create, but handle duplicate error by falling back to PATCH
          try {
            await this.request('/appStoreVersionLocalizations', {
              method: 'POST',
              body: {
                data: {
                  type: 'appStoreVersionLocalizations',
                  attributes: {locale: loc.locale, ...versionAttrs},
                  relationships: {
                    appStoreVersion: {
                      data: {type: 'appStoreVersions', id: editableVersion.id},
                    },
                  },
                },
              },
            });
            results.versionLocalizationsCreated.push(loc.locale);
          } catch (error) {
            // If duplicate error, fetch and PATCH instead
            if (
              error instanceof Error &&
              error.message.includes('DUPLICATE')
            ) {
              const refetch =
                await this.request<AppStoreVersionLocalizationsResponse>(
                  `/appStoreVersions/${editableVersion.id}/appStoreVersionLocalizations?filter[locale]=${loc.locale}`
                );
              const existing = refetch.data[0];
              if (existing) {
                await this.request(
                  `/appStoreVersionLocalizations/${existing.id}`,
                  {
                    method: 'PATCH',
                    body: {
                      data: {
                        type: 'appStoreVersionLocalizations',
                        id: existing.id,
                        attributes: versionAttrs,
                      },
                    },
                  }
                );
                results.versionLocalizationsUpdated.push(loc.locale);
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
      }
    }

    return results;
  }
}

export interface SetMetadataResult {
  appInfoLocalizationsUpdated: string[];
  appInfoLocalizationsCreated: string[];
  versionLocalizationsUpdated: string[];
  versionLocalizationsCreated: string[];
}
