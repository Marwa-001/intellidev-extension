const path = require('path');
const fs = require('fs');

// Stub vscode
const vscode = {
  Uri: { file: (p) => ({ fsPath: p }) },
  WebviewViewProvider: class {},
};
require('module').prototype.require = new Proxy(require('module').prototype.require, {
  apply(target, thisArg, argumentsList) {
    if (argumentsList[0] === 'vscode') return vscode;
    return Reflect.apply(target, thisArg, argumentsList);
  }
});

const { IntelliDevDashboardProvider } = require('../out/dashboardProvider.js');
const provider = new IntelliDevDashboardProvider(vscode.Uri.file(__dirname), { setFeaturesDir: () => {} }, __dirname);
const html = provider._getHtmlContent();

const scriptMatch = html.match(/<script nonce=".*?">([\s\S]*?)<\/script>/);
if (scriptMatch) {
  const script = scriptMatch[1];
  try {
    new Function(script);
    console.log('Valid JS syntax!');
  } catch (e) {
    console.error('SyntaxError in generated JS:', e);
  }
}
