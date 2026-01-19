#!/usr/bin/env node
import yargs, {ArgumentsCamelCase, Argv, CommandModule} from 'yargs';
import {hideBin} from 'yargs/helpers';
import * as fs from 'fs';
import {loadConfig} from './config.js';
import {
  AppStoreConnectClient,
  LocalizedMetadata,
  Platform,
} from './appstoreconnect.js';
import {
  outputAppList,
  outputGooglePlayAppList,
  outputGooglePlayMetadata,
  outputGooglePlaySetMetadataResult,
  outputMetadata,
  outputSetMetadataResult,
  outputVersion,
} from './output.js';
import {GooglePlayListing} from './googleplay.js';
import {GooglePlayClient} from './googleplay.js';
import {validateAppleLocales, validateGooglePlayLocales} from './locales.js';

interface GlobalOptions {
  config?: string;
  json?: boolean;
}

function requireAppleConfig(argv: {config?: string}) {
  const {config, configDir} = loadConfig(argv.config);
  if (!config.appstore_connect) {
    throw new Error('Missing [appstore_connect] section in config');
  }
  return {config: config.appstore_connect, configDir};
}

type VersionSource = 'live' | 'editable';

interface ShowMetadataOptions extends GlobalOptions {
  bundleId: string;
  locale?: string;
  from?: VersionSource;
}

interface CreateVersionOptions extends GlobalOptions {
  bundleId: string;
  versionString: string;
  platform?: Platform;
}

interface SetMetadataOptions extends GlobalOptions {
  bundleId: string;
  filename: string;
}

interface GoogleMetadataOptions extends GlobalOptions {
  packageName: string;
  language?: string;
}

interface GoogleSetMetadataOptions extends GlobalOptions {
  packageName: string;
  filename: string;
}

const appleCommand: CommandModule<GlobalOptions, GlobalOptions> = {
  command: 'apple',
  describe: 'App Store Connect commands',
  builder: (y: Argv<GlobalOptions>) => {
    return y
      .command({
        command: 'list-apps',
        describe: 'List all apps in App Store Connect',
        handler: async (argv: ArgumentsCamelCase<GlobalOptions>) => {
          const {config, configDir} = requireAppleConfig(argv);
          const client = new AppStoreConnectClient(config, configDir);

          const apps = await client.listApps();
          outputAppList(apps, {json: argv.json});
        },
      })
      .command({
        command: 'get-metadata <bundleId> [locale]',
        describe: 'Get app metadata (all languages, or full details for one)',
        builder: yargs =>
          yargs
            .positional('bundleId', {
              describe: 'The bundle ID of the app',
              type: 'string',
              demandOption: true,
            })
            .positional('locale', {
              describe: 'Locale to show in full (e.g., en-US)',
              type: 'string',
            })
            .option('from', {
              describe: 'Which version to fetch localizations from',
              choices: ['live', 'editable'] as const,
              default: 'editable' as const,
            }),
        handler: async (argv: ArgumentsCamelCase<ShowMetadataOptions>) => {
          const {config, configDir} = requireAppleConfig(argv);
          const client = new AppStoreConnectClient(config, configDir);

          const metadata = await client.getAppMetadata(argv.bundleId, argv.from);
          outputMetadata(metadata, argv.locale, argv.from, {json: argv.json});
        },
      })
      .command({
        command: 'create-version <bundleId> <versionString>',
        describe: 'Create a new App Store version',
        builder: yargs =>
          yargs
            .positional('bundleId', {
              describe: 'The bundle ID of the app',
              type: 'string',
              demandOption: true,
            })
            .positional('versionString', {
              describe: 'Version string (e.g., 1.2.0)',
              type: 'string',
              demandOption: true,
            })
            .option('platform', {
              describe: 'Platform (defaults to latest version platform)',
              choices: ['IOS', 'MAC_OS', 'TV_OS', 'VISION_OS'] as const,
              type: 'string',
            }),
        handler: async (argv: ArgumentsCamelCase<CreateVersionOptions>) => {
          const {config, configDir} = requireAppleConfig(argv);
          const client = new AppStoreConnectClient(config, configDir);

          const version = await client.createVersion(
            argv.bundleId,
            argv.versionString,
            argv.platform
          );
          outputVersion(version, {json: argv.json});
        },
      })
      .command({
        command: 'set-metadata <bundleId>',
        describe: 'Update app metadata from a JSON file',
        builder: yargs =>
          yargs
            .positional('bundleId', {
              describe: 'The bundle ID of the app',
              type: 'string',
              demandOption: true,
            })
            .option('filename', {
              alias: 'f',
              describe: 'JSON file containing metadata (same format as show-metadata output)',
              type: 'string',
              demandOption: true,
            }),
        handler: async (argv: ArgumentsCamelCase<SetMetadataOptions>) => {
          const {config, configDir} = requireAppleConfig(argv);
          const client = new AppStoreConnectClient(config, configDir);

          const fileContent = fs.readFileSync(argv.filename, 'utf-8');
          const metadata = JSON.parse(fileContent) as {
            localizations: LocalizedMetadata[];
          };

          if (!metadata.localizations || !Array.isArray(metadata.localizations)) {
            throw new Error(
              'Invalid metadata file: expected "localizations" array'
            );
          }

          const locales = metadata.localizations.map(l => l.locale);
          const invalidLocales = validateAppleLocales(locales);
          if (invalidLocales.length > 0) {
            throw new Error(
              `Invalid locale(s) for App Store Connect: ${invalidLocales.join(', ')}`
            );
          }

          const result = await client.setMetadata(
            argv.bundleId,
            metadata.localizations
          );
          outputSetMetadataResult(result, {json: argv.json});
        },
      });
  },
  handler: () => {
    console.log('Use "slowlane apple --help" for available commands');
  },
};

function requireGoogleConfig(argv: {config?: string}) {
  const {config, configDir} = loadConfig(argv.config);
  if (!config.google_play) {
    throw new Error('Missing [google_play] section in config');
  }
  return {config: config.google_play, configDir};
}

const googleCommand: CommandModule<GlobalOptions, GlobalOptions> = {
  command: 'google',
  describe: 'Google Play commands',
  builder: (y: Argv<GlobalOptions>) => {
    return y
      .command({
        command: 'list-apps',
        describe: 'List all apps',
        handler: async (argv: ArgumentsCamelCase<GlobalOptions>) => {
          const {config, configDir} = requireGoogleConfig(argv);
          const client = new GooglePlayClient(config, configDir);

          const apps = await client.listApps();
          outputGooglePlayAppList(apps, {json: argv.json});
        },
      })
      .command({
        command: 'get-metadata <packageName> [language]',
        describe: 'Get app metadata (all languages, or full details for one)',
        builder: yargs =>
          yargs
            .positional('packageName', {
              describe: 'The package name of the app',
              type: 'string',
              demandOption: true,
            })
            .positional('language', {
              describe: 'Language to show in full (e.g., en-US)',
              type: 'string',
            }),
        handler: async (argv: ArgumentsCamelCase<GoogleMetadataOptions>) => {
          const {config, configDir} = requireGoogleConfig(argv);
          const client = new GooglePlayClient(config, configDir);

          const metadata = await client.getMetadata(argv.packageName);
          outputGooglePlayMetadata(metadata, argv.language, {json: argv.json});
        },
      })
      .command({
        command: 'set-metadata <packageName>',
        describe:
          'Update app metadata from a JSON file. Changes are sent for review automatically.',
        builder: yargs =>
          yargs
            .positional('packageName', {
              describe: 'The package name of the app',
              type: 'string',
              demandOption: true,
            })
            .option('filename', {
              alias: 'f',
              describe:
                'JSON file containing metadata (same format as get-metadata output)',
              type: 'string',
              demandOption: true,
            }),
        handler: async (argv: ArgumentsCamelCase<GoogleSetMetadataOptions>) => {
          const {config, configDir} = requireGoogleConfig(argv);
          const client = new GooglePlayClient(config, configDir);

          const fileContent = fs.readFileSync(argv.filename, 'utf-8');
          const metadata = JSON.parse(fileContent) as {
            listings: GooglePlayListing[];
          };

          if (!metadata.listings || !Array.isArray(metadata.listings)) {
            throw new Error('Invalid metadata file: expected "listings" array');
          }

          const locales = metadata.listings.map(l => l.language);
          const invalidLocales = validateGooglePlayLocales(locales);
          if (invalidLocales.length > 0) {
            throw new Error(
              `Invalid locale(s) for Google Play: ${invalidLocales.join(', ')}`
            );
          }

          const result = await client.setMetadata(
            argv.packageName,
            metadata.listings
          );
          outputGooglePlaySetMetadataResult(result, {json: argv.json});
        },
      });
  },
  handler: () => {
    console.log('Use "slowlane google --help" for available commands');
  },
};

yargs(hideBin(process.argv))
  .scriptName('slowlane')
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config file',
  })
  .option('json', {
    type: 'boolean',
    description: 'Output in JSON format',
    default: false,
  })
  .command(appleCommand)
  .command(googleCommand)
  .demandCommand(1, 'You need to specify a command')
  .strict()
  .help()
  .parse();
