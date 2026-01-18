#!/usr/bin/env node
import yargs, {ArgumentsCamelCase, Argv, CommandModule} from 'yargs';
import {hideBin} from 'yargs/helpers';
import {loadConfig} from './config.js';
import {AppStoreConnectClient} from './appstoreconnect.js';
import {outputAppList, outputMetadata} from './output.js';

interface GlobalOptions {
  config?: string;
  json?: boolean;
}

interface ShowMetadataOptions extends GlobalOptions {
  bundleId: string;
  locale?: string;
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
          const {config, configDir} = loadConfig(argv.config);
          const client = new AppStoreConnectClient(
            config.appstore_connect,
            configDir
          );

          const apps = await client.listApps();
          outputAppList(apps, {json: argv.json});
        },
      })
      .command({
        command: 'show-metadata <bundleId> [locale]',
        describe: 'Show app metadata (all languages, or full details for one)',
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
            }),
        handler: async (argv: ArgumentsCamelCase<ShowMetadataOptions>) => {
          const {config, configDir} = loadConfig(argv.config);
          const client = new AppStoreConnectClient(
            config.appstore_connect,
            configDir
          );

          const metadata = await client.getAppMetadata(argv.bundleId);
          outputMetadata(metadata, argv.locale, {json: argv.json});
        },
      });
  },
  handler: () => {
    console.log('Use "slowlane apple --help" for available commands');
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
  .demandCommand(1, 'You need to specify a command')
  .strict()
  .help()
  .parse();
