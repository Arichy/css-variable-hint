// go to declaration
// completion

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionParams,
  createConnection,
  InitializeParams,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  Location,
  FileChangeType,
  DidChangeConfigurationNotification,
} from 'vscode-languageserver/node';
import * as fs from 'fs';
import * as path from 'path';
import * as fb from 'fast-glob';
import {
  parse,
  Node as PostcssNode,
  AtRule,
  Rule,
  Declaration,
  Position as PostcssPosition,
  Root,
} from 'postcss';
import { parse as parseScss } from 'postcss-scss';
import { parse as parseLess } from 'postcss-less';
import {
  uriToFilePath,
  filePathToUri,
  getCurrentWord,
  isColor,
} from '../utils';
import defaultConfig from '../defaultConfig';
import TreeCache from '../utils/TreeCache';

const configurationKey = 'cssVariableHint';

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let root = '';

let targetCssFiles: string[] = [];

let completionItems: CompletionItem[] = [];

const variableMap = new TreeCache<string, CompletionItem[]>();
const fileMap = new Map<string, CompletionItem[]>();

const getRootPath = (node: PostcssNode) => {
  const path: string[] = [];
  while (node.parent) {
    node = node.parent;
    switch (node.type) {
      case 'rule':
        path.push((node as Rule).selector);
        break;
      case 'atrule':
        const { params, name } = node as AtRule;
        path.push(`@${name} ${params}`);
        break;
    }
  }

  return path.reverse();
};

connection.onInitialize(async (params: InitializeParams) => {
  if (!params.workspaceFolders) {
    return {
      capabilities: {},
    };
  }

  root = uriToFilePath(params.workspaceFolders[0].uri);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      completionProvider: {
        resolveProvider: true,
        completionItem: {
          labelDetailsSupport: true,
        },
      },
      workspace: {
        workspaceFolders: {
          supported: true,
        },
      },
    },
  };
});

function createCompletionItemByDecl(decl: Declaration): CompletionItem {
  const variableName = decl.prop;
  const value = decl.value;

  const paths = getRootPath(decl);
  let pathString = '';
  for (let i = 0; i < paths.length; i++) {
    for (let j = 0; j < i * 4; j++) {
      pathString += ' ';
    }
    if (i > 0) {
      pathString += '|';
      pathString += '— ';
    }
    pathString += paths[i] + '\n';
  }

  const item = {
    kind: isColor(value)
      ? CompletionItemKind.Color
      : CompletionItemKind.Variable,
    data: {
      filePath: decl.source.input.from, // key level 1
      range: extractRangeFromDecl(decl),
    },
    label: variableName, // text inserted into editor
    labelDetails: {
      description: value, // hint at right
    },
    // `detail` for colored background: https://github.com/microsoft/vscode/blob/main/src/vs/editor/contrib/suggest/browser/suggestWidgetRenderer.ts#L176
    detail: value,
    documentation: {
      kind: MarkupKind.PlainText,
      value: `
${variableName}: ${value}

source: ${path.relative(root, decl.source.input.file)}

${pathString}
                `.trim(),
    },
  };

  return item;
}

function extractRangeFromDecl(decl: Declaration) {
  return {
    start: decl.source.start,
    end: decl.source.end,
  };
}

function generateCompletionItems() {
  const result: CompletionItem[] = [];
  for (const items of fileMap.values()) {
    result.push(...items);
  }

  completionItems = result;
}

function getAst(cssFilePath: string): Root | undefined {
  const content = fs.readFileSync(cssFilePath, 'utf-8');
  const extname = path.extname(cssFilePath);

  try {
    switch (extname) {
      case '.scss':
        return parseScss(content, { from: cssFilePath });
      case '.less':
        return parseLess(content, { from: cssFilePath }) as Root;
      default:
        return parse(content, { from: cssFilePath });
    }
  } catch (err) {
    console.log(err);
    return undefined;
  }
}

function handleCssFileCreated(cssFilePath: string) {
  fileMap.set(cssFilePath, []);

  const ast = getAst(cssFilePath);

  if (!ast) {
    return;
  }

  ast.walkDecls((decl) => {
    if (!decl.variable) {
      return;
    }

    const item = createCompletionItemByDecl(decl);

    const variableName = decl.prop;
    if (!variableMap.has([variableName, cssFilePath])) {
      variableMap.set([variableName, cssFilePath], []);
    }
    variableMap.get([variableName, cssFilePath]).push(item);

    fileMap.get(cssFilePath).push(item);

    completionItems.push(item);
  });
}

function handleCssFileChanged(cssFilePath: string) {
  const prevItems = fileMap.get(cssFilePath);
  const toBeRemovedVariables = new Set(prevItems.map((item) => item.label)); // variables not in this file after change

  fileMap.delete(cssFilePath);
  fileMap.set(cssFilePath, []);

  const ast = getAst(cssFilePath);

  if (!ast) {
    return;
  }

  const visitedVariableNames = new Set<string>();

  ast.walkDecls((decl) => {
    if (!decl.variable) {
      return;
    }

    const item = createCompletionItemByDecl(decl);

    const variableName = decl.prop;
    toBeRemovedVariables.delete(variableName);

    if (!variableMap.has([variableName, cssFilePath])) {
      // new variable
      variableMap.set([variableName, cssFilePath], []);
    } else {
      if (!visitedVariableNames.has(variableName)) {
        // remove old items
        variableMap.set([variableName, cssFilePath], []);
        visitedVariableNames.add(variableName);
      }
    }
    // new items
    variableMap.get([variableName, cssFilePath]).push(item);

    fileMap.get(cssFilePath).push(item);
  });

  for (const variableName of toBeRemovedVariables) {
    variableMap.deleteSubTree([variableName, cssFilePath]);

    if (variableMap.getNode([variableName]).childMap.size === 0) {
      variableMap.deleteSubTree([variableName]);
    }
  }

  generateCompletionItems();
}

function handleCssFileDeleted(cssFilePath: string) {
  const prevItems = fileMap.get(cssFilePath);
  const toBeRemovedVariables = new Set(prevItems.map((item) => item.label));

  fileMap.delete(cssFilePath);

  let i = 0;
  for (const variableName of toBeRemovedVariables) {
    variableMap.deleteSubTree([variableName, cssFilePath]);

    try {
      if (variableMap.getNode([variableName]).childMap.size === 0) {
        variableMap.deleteSubTree([variableName]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  generateCompletionItems();
}

connection.onInitialized(async () => {
  const config = (await connection.workspace.getConfiguration(
    configurationKey
  )) as typeof defaultConfig;

  connection.client.register(DidChangeConfigurationNotification.type);

  targetCssFiles = fb.sync(config.lookupFiles, {
    absolute: true,
    cwd: root,
  });

  targetCssFiles.forEach((cssFilePath) => handleCssFileCreated(cssFilePath));
});

connection.onCompletion((params: CompletionParams) => {
  // completion at inputting value

  const { position, textDocument } = params;
  const document = documents.get(textDocument.uri);
  if (!document) {
    return null;
  }

  const text = document.getText();

  let flag = false;
  let reg = /var\([^\)]*$/;
  for (let j = position.character; j >= 0; j--) {
    let curInput = text.slice(
      document.offsetAt({ line: position.line, character: j }),
      document.offsetAt(position)
    );
    if (reg.test(curInput)) {
      flag = true;
      break;
    }
  }

  return flag ? completionItems : null;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const currentWord = getCurrentWord(
    document,
    document.offsetAt(params.position)
  );

  if (!variableMap.root.childMap.has(currentWord)) {
    return null;
  }

  const items: CompletionItem[] = [];
  for (const node of variableMap.root.childMap
    .get(currentWord)
    .childMap.values()) {
    items.push(...node.value);
  }

  return items.map((item) => {
    const range = item.data.range as {
      start: PostcssPosition;
      end: PostcssPosition;
    };

    const source = item.data.filePath as string;

    const start = {
      line: range.start.line - 1,
      character: range.start.column - 1,
    };
    const end = {
      line: range.end.line - 1,
      character: range.end.column - 1,
    };

    return Location.create(filePathToUri(source), {
      start,
      end,
    });
  });
});

connection.onDidChangeWatchedFiles(({ changes }) => {
  for (const { type, uri } of changes) {
    switch (type) {
      case FileChangeType.Created:
        handleCssFileCreated(uriToFilePath(uri));
        break;

      case FileChangeType.Changed:
        handleCssFileChanged(uriToFilePath(uri));
        break;

      case FileChangeType.Deleted:
        handleCssFileDeleted(uriToFilePath(uri));
        break;
    }
  }
});

connection.onDidChangeConfiguration(async (params) => {
  const config = (await connection.workspace.getConfiguration(
    configurationKey
  )) as typeof defaultConfig;

  const prevCssFiles = [...targetCssFiles];

  targetCssFiles = fb.sync(config.lookupFiles, {
    absolute: true,
    cwd: root,
  });

  const addedFiles = targetCssFiles.filter(
    (file) => !prevCssFiles.includes(file)
  );
  const removedFiles = prevCssFiles.filter(
    (file) => !targetCssFiles.includes(file)
  );

  for (const file of addedFiles) {
    handleCssFileCreated(file);
  }

  for (const file of removedFiles) {
    handleCssFileDeleted(file);
  }
});

documents.listen(connection);

connection.listen();
