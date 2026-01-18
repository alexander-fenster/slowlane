import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import {SlowlaneConfig} from './appstoreconnect.js';

interface TomlAppStoreConnect {
  issuer_id: string;
  key_id: string;
  private_key_path: string;
}

interface TomlGooglePlay {
  service_account_path: string;
  packages?: string[];
}

interface TomlConfig {
  appstore_connect?: TomlAppStoreConnect;
  google_play?: TomlGooglePlay;
}

export function loadConfig(configPath?: string): {
  config: SlowlaneConfig;
  configDir: string;
} {
  const resolvedPath = configPath ?? path.join(process.cwd(), 'slowlane.toml');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const parsed = toml.parse(content) as unknown as TomlConfig;

  const config: SlowlaneConfig = {};

  if (parsed.appstore_connect) {
    config.appstore_connect = {
      issuer_id: parsed.appstore_connect.issuer_id,
      key_id: parsed.appstore_connect.key_id,
      private_key_path: parsed.appstore_connect.private_key_path,
    };
  }

  if (parsed.google_play) {
    config.google_play = {
      service_account_path: parsed.google_play.service_account_path,
      packages: parsed.google_play.packages,
    };
  }

  return {
    config,
    configDir: path.dirname(resolvedPath),
  };
}
