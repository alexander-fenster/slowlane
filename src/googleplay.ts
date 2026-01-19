import * as fs from 'fs';
import * as path from 'path';
import {google, androidpublisher_v3} from 'googleapis';
import {GooglePlayConfig} from './appstoreconnect.js';

type AndroidPublisher = androidpublisher_v3.Androidpublisher;

export interface GooglePlayApp {
  packageName: string;
  displayName: string;
}

export interface GooglePlayListing {
  language: string;
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  video?: string;
}

export interface GooglePlayMetadata {
  packageName: string;
  defaultLanguage?: string;
  listings: GooglePlayListing[];
}

export interface GooglePlaySetMetadataResult {
  listingsUpdated: string[];
  listingsCreated: string[];
}

export class GooglePlayClient {
  private readonly auth: InstanceType<typeof google.auth.JWT>;
  private readonly publisher: AndroidPublisher;

  constructor(config: GooglePlayConfig, configDir: string) {
    const keyPath = path.isAbsolute(config.service_account_path)
      ? config.service_account_path
      : path.join(configDir, config.service_account_path);

    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8')) as {
      client_email: string;
      private_key: string;
    };

    this.auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: [
        'https://www.googleapis.com/auth/playdeveloperreporting',
        'https://www.googleapis.com/auth/androidpublisher',
      ],
    });

    this.publisher = google.androidpublisher({version: 'v3', auth: this.auth});
  }

  async listApps(): Promise<GooglePlayApp[]> {
    const accessToken = await this.auth.getAccessToken();

    const response = await fetch(
      'https://playdeveloperreporting.googleapis.com/v1beta1/apps:search',
      {
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Play API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const data = (await response.json()) as {
      apps?: Array<{
        name: string;
        packageName: string;
        displayName: string;
      }>;
    };

    return (data.apps ?? []).map(app => ({
      packageName: app.packageName,
      displayName: app.displayName,
    }));
  }

  async getMetadata(packageName: string): Promise<GooglePlayMetadata> {
    // Create an edit to read the current state
    const editResponse = await this.publisher.edits.insert({packageName});
    const editId = editResponse.data.id!;

    try {
      // Get app details for default language
      const detailsResponse = await this.publisher.edits.details.get({
        packageName,
        editId,
      });

      // Get all listings
      const listingsResponse = await this.publisher.edits.listings.list({
        packageName,
        editId,
      });

      const listings: GooglePlayListing[] = (
        listingsResponse.data.listings ?? []
      ).map(listing => ({
        language: listing.language!,
        title: listing.title ?? undefined,
        shortDescription: listing.shortDescription ?? undefined,
        fullDescription: listing.fullDescription ?? undefined,
        video: listing.video ?? undefined,
      }));

      // Sort by language
      listings.sort((a, b) => a.language.localeCompare(b.language));

      return {
        packageName,
        defaultLanguage: detailsResponse.data.defaultLanguage ?? undefined,
        listings,
      };
    } finally {
      // Delete the edit since we're just reading
      await this.publisher.edits.delete({packageName, editId});
    }
  }

  async setMetadata(
    packageName: string,
    listings: GooglePlayListing[]
  ): Promise<GooglePlaySetMetadataResult> {
    // Create an edit to make changes
    const editResponse = await this.publisher.edits.insert({packageName});
    const editId = editResponse.data.id!;

    const result: GooglePlaySetMetadataResult = {
      listingsUpdated: [],
      listingsCreated: [],
    };

    try {
      // Get existing listings to know which languages already exist
      const existingListingsResponse = await this.publisher.edits.listings.list(
        {
          packageName,
          editId,
        }
      );
      const existingLanguages = new Set(
        (existingListingsResponse.data.listings ?? []).map(l => l.language!)
      );

      for (const listing of listings) {
        // Build request body with only the fields that are present
        const requestBody: {
          language?: string;
          title?: string;
          shortDescription?: string;
          fullDescription?: string;
          video?: string;
        } = {};

        if ('title' in listing) requestBody.title = listing.title;
        if ('shortDescription' in listing)
          requestBody.shortDescription = listing.shortDescription;
        if ('fullDescription' in listing)
          requestBody.fullDescription = listing.fullDescription;
        if ('video' in listing) requestBody.video = listing.video;

        if (existingLanguages.has(listing.language)) {
          // Use patch to update only provided fields
          await this.publisher.edits.listings.patch({
            packageName,
            editId,
            language: listing.language,
            requestBody,
          });
          result.listingsUpdated.push(listing.language);
        } else {
          // Use update to create new listing (requires language in body)
          requestBody.language = listing.language;
          await this.publisher.edits.listings.update({
            packageName,
            editId,
            language: listing.language,
            requestBody,
          });
          result.listingsCreated.push(listing.language);
        }
      }

      // Commit the edit to apply changes
      await this.publisher.edits.commit({
        packageName,
        editId,
      });

      return result;
    } catch (error) {
      // Delete the edit if something went wrong
      await this.publisher.edits.delete({packageName, editId}).catch(() => {});
      throw error;
    }
  }
}
