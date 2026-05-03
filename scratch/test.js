const fs = require('fs');
const code = fs.readFileSync('src/dashboardProvider.ts', 'utf8');

const htmlMatch = code.match(/return `<!DOCTYPE html>([\s\S]*?)<\/html>`;/);
if (htmlMatch) {
  let html = htmlMatch[0];
  const scriptMatch = html.match(/<script nonce="\${nonce}">([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    let script = scriptMatch[1]
      .replace(/\\\${/g, '${')
      .replace(/\\`/g, '`')
      .replace(/\\'/g, "'");
    fs.writeFileSync('scratch/extracted_script.js', script);
    console.log('Script extracted.');
  } else {
    console.log('No script tag found.');
  }
} else {
  console.log('HTML not found.');
}
