// electron-builder custom sign hook. Signs with the YubiKey cert configured in
// the sign.json pointed to by CODESIGN_CONFIG; does nothing when that is unset
// so unsigned dev builds keep working.
const { execFileSync } = require('child_process');
const fs = require('fs');

module.exports = async function sign(configuration) {
  const configPath = process.env.CODESIGN_CONFIG;
  if (!configPath) return;
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const signtool = cfg.signtool_path;
  const file = configuration.path;

  try {
    execFileSync(signtool, ['verify', '/pa', '/q', file], { stdio: 'ignore' });
    console.log(`  already signed: ${file}`);
    return;
  } catch {
    // not signed yet
  }

  const digest = cfg.digest_algorithm || 'sha256';
  console.log(`  signing: ${file}`);
  execFileSync(signtool, [
    'sign', '/sha1', cfg.thumbprint,
    '/tr', cfg.timestamp_server, '/td', digest, '/fd', digest,
    file,
  ], { stdio: 'inherit' });
};
