'use strict';
// electron-builder afterSign hook: tidy the Windows executable's version strings before
// the installer and zip are made. Fills in OriginalFilename (Electron leaves it blank) and
// removes SquirrelAwareVersion (this app doesn't use the Squirrel updater).
const fs = require('fs');
const path = require('path');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exeName = context.packager.platformSpecificBuildOptions.executableName + '.exe';
  const exePath = path.join(context.appOutDir, exeName);
  const ResEdit = await import('resedit');
  const PELibrary = await import('pe-library');
  const R = ResEdit.default || ResEdit;
  const P = PELibrary.default || PELibrary;

  const exe = P.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = P.NtExecutableResource.from(exe);
  const infos = R.Resource.VersionInfo.fromEntries(res.entries);
  for (const vi of infos) {
    for (const lang of vi.getAllLanguagesForStringValues()) {
      vi.setStringValues(lang, { OriginalFilename: exeName, InternalName: exeName.replace(/\.exe$/, '') });
      vi.removeStringValue(lang, 'SquirrelAwareVersion');
    }
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • afterSign: version strings tidied  file=' + exeName);
};
