import * as vscode from 'vscode';
import * as path from 'path';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

const configurationKey = 'cssVariableHint';

function createClient(
  context: vscode.ExtensionContext,
  watchedFiles: string[]
): LanguageClient {
  const serverModule = context.asAbsolutePath(
    path.resolve('out', 'server', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect-brk=6010'],
      },
    },
  };

  const watchers = watchedFiles.map((glob) => {
    const pattern = new vscode.RelativePattern(
      vscode.workspace.workspaceFolders[0].uri,
      glob
    );

    return vscode.workspace.createFileSystemWatcher(
      pattern,
      false,
      false,
      false
    );
  });

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        scheme: 'file',
        language: 'scss',
      },
      {
        scheme: 'file',
        language: 'css',
      },
    ],
    synchronize: {
      fileEvents: watchers,
    },
  };

  // to test watchers
  // watchers.forEach((watcher) => {
  //   watcher.onDidChange((uri) => {
  //     console.log('change', uri);
  //   });
  // });

  client = new LanguageClient(
    'css-variable-hint',
    'CSS Variable Hint',
    serverOptions,
    clientOptions
  );

  return client;
}

export function activate(context: vscode.ExtensionContext) {
  if (
    !vscode.workspace ||
    !vscode.workspace.workspaceFolders ||
    !vscode.workspace.workspaceFolders[0]
  ) {
    return;
  }

  const config = vscode.workspace.getConfiguration(configurationKey);
  const lookupFiles = config.get('lookupFiles') as string[];

  client = createClient(context, lookupFiles);

  client.start();

  const restartServerComd = vscode.commands.registerCommand(
    'css-variable-hint.restartServer',
    () => {
      client.stop();

      const config = vscode.workspace.getConfiguration(configurationKey);
      const lookupFiles = config.get('lookupFiles') as string[];

      client = createClient(context, lookupFiles);

      client.start();
    }
  );

  context.subscriptions.push(restartServerComd);
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }

  return client.stop();
}
