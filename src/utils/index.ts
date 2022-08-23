import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export const markdown = (
  strings: TemplateStringsArray,
  ...expArr: string[]
): string => {
  let res = '';
  for (let i = 0; i < strings.length; i++) {
    res += strings[i];
    if (i < expArr.length) {
      res += expArr[i];
    }
  }

  return res.trim();
};

export const uriToFilePath = (uri: string): string => {
  const parsedURI = URI.parse(uri);
  if (parsedURI.scheme !== 'file') {
    return '';
  }

  return parsedURI.fsPath;
};

export const filePathToUri = (path: string): string => {
  return URI.file(path).toString();
};

export const getCurrentWord = (
  document: TextDocument,
  offset: number
): string => {
  const text = document.getText();
  let left = offset;
  let right = offset;

  const check = (char: string): boolean => {
    let reg = /\S/;

    return reg.test(char) && char !== '(' && char !== ')';
  };

  while (left >= 0 && check(text[left])) {
    left--;
  }
  while (right < text.length && check(text[right])) {
    right++;
  }

  left++;
  right--;

  return text.slice(left, right + 1);
};

export const isColor = (value: string): boolean => {
  const rgbaReg = /rgba?\(.*\)/;
  const hexReg = /#[\dabcdef]+/;

  return rgbaReg.test(value) || hexReg.test(value);
};
