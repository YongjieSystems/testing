import fs from 'node:fs';
const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);
for (const [file, assets] of [['index.html', ['app.js','interface.css']], ['app.js', ['quote-core.js', 'warranty-data.js', 'driver-data.js', 'training.js', 'pricing-config.js', 'team-workspace.js']], ['driver-data.js',['warranty-data.js']], ['team-workspace.js', ['team-core.js', 'team-config.js', 'login-session.js']]]) {
    const path = new URL(file, root);
    let source = fs.readFileSync(path, 'utf8');
    if(file==='index.html') source=source.replace(/(<small class="text-xs">)v[\d.]+(<\/small>)/,`$1v${version}$2`);
    for (const asset of assets) {
        const escaped = asset.replaceAll('.', '\\.');
        source = source.replace(new RegExp(`\\./${escaped}(?:\\?v=[^'"\\s]+)?`, 'g'), `./${asset}?v=${version}`);
    }
    fs.writeFileSync(path, source);
}
