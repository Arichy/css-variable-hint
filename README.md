# css-variable-hint

## Features

Add some css variables language features for `.css`, `.scss` files:

- CSS variable completion
![alt command](https://github.com/Arichy/css-variable-hint/raw/main/resources/markdown/completion.gif)

- CSS variable goto definition
![alt command](https://github.com/Arichy/css-variable-hint/raw/main/resources/markdown/definition.gif)

---
## Advantages compared with other similar extensions:
- **Support multiple variables**: It's very common that we need to declare one css variable with multiple values. For example, to support `dark mode`, we often declare a color variable in `html`, and declare the same color variable in `html[data-theme=dark]` with another value. This extension will display all values for every variable to let you choose freely.

- **Source tree display**: One variable may have multiple values, so this extension will display every value with its source to let you recognize which one is what you need.

- **Hot-reload**: File changes outside `node_modules` can be watched to update the completion items.

## Extension Settings

This extension contributes the following settings:

- `cssVariableHint.lookupFiles`
  - `description`: Files to look for all css variables
  - `defaultValue`:

```json
[
  "{,!(node_modules)/**/}*.css",
  "{,!(node_modules)/**/}*.sass",
  "{,!(node_modules)/**/}*.scss",
  "{,!(node_modules)/**/}*.less"
]
```

## Known Issues

File changes in `node_modules` cannot be watched because of vscode's default `files.watcherExclude` setting, so if you changed css variables in `node_modules`, you need to run the command `CSS Variable Hint: Restart Server` in vscode.