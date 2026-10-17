import fs from 'node:fs';
const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);
for (const [file, assets] of [['index.html', ['app.js']], ['app.js', ['quote-core.js', 'warranty-data.js']]]) {
    const path = new URL(file, root);
    let source = fs.readFileSync(path, 'utf8');
    for (const asset of assets) {
        const escaped = asset.replaceAll('.', '\\.');
        source = source.replace(new RegExp(`\\./${escaped}(?:\\?v=[^'"\\s]+)?`, 'g'), `./${asset}?v=${version}`);
    }
    fs.writeFileSync(path, source);
}
