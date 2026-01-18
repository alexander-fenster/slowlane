import * as fs from 'fs';
import * as path from 'path';
import {google} from 'googleapis';
import {GooglePlayConfig} from './appstoreconnect.js';

export interface GooglePlayApp {
  packageName: string;
  displayName: string;
}

export class GooglePlayClient {
  private readonly auth: InstanceType<typeof google.auth.JWT>;

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
}
