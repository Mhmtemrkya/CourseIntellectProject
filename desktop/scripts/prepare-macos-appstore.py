"""Validate store signing inputs and derive sandbox entitlements from the profile."""
import datetime
import hashlib
import json
import os
import pathlib
import plistlib
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
profile_path = pathlib.Path(os.environ.get('MAS_PROVISIONING_PROFILE', '')).expanduser()
app_identity = os.environ.get('MAS_SIGNING_IDENTITY', '')
installer_identity = os.environ.get('MAS_INSTALLER_IDENTITY', '')

def fail(message):
    sys.exit('HATA: ' + message)

if not profile_path.is_file():
    fail('MAS_PROVISIONING_PROFILE, Mac App Store Connect provisioning profilinin mutlak yolu olmalı.')
if not app_identity.startswith(('Apple Distribution:', '3rd Party Mac Developer Application:')):
    fail('MAS_SIGNING_IDENTITY için Apple Distribution veya 3rd Party Mac Developer Application sertifikası gerekli.')
if not installer_identity.startswith(('Mac Installer Distribution:', '3rd Party Mac Developer Installer:')):
    fail('MAS_INSTALLER_IDENTITY için Mac Installer Distribution sertifikası gerekli.')

profile = plistlib.loads(subprocess.check_output(['security', 'cms', '-D', '-i', str(profile_path)]))
config = json.loads((root / 'src-tauri/tauri.conf.json').read_text())
team = 'RM53R2ZT6Q'
entitlements = profile.get('Entitlements', {})
app_id = entitlements.get('com.apple.application-identifier', '')
if profile.get('TeamIdentifier') != [team] or entitlements.get('com.apple.developer.team-identifier') != team:
    fail('Provisioning profili SchoolAsist Apple ekibi RM53R2ZT6Q ile eşleşmiyor.')
if not app_id.endswith('.' + config['identifier']) or '*' in app_id:
    fail('Provisioning profilinin uygulama kimliği com.courseintellect.desktop ile eşleşmiyor.')
if 'OSX' not in profile.get('Platform', []):
    fail('Bir macOS provisioning profili gerekli.')
if profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices') or entitlements.get('get-task-allow') or entitlements.get('com.apple.security.get-task-allow'):
    fail('Geliştirme/Developer ID profili kullanılamaz; Mac App Store Connect profili gerekli.')
if profile.get('ExpirationDate', datetime.datetime.min) <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
    fail('Provisioning profilinin süresi dolmuş.')

identities = subprocess.check_output(['security', 'find-identity', '-v', '-p', 'codesigning'], text=True)
matching = [line for line in identities.splitlines() if f'"{app_identity}"' in line]
if len(matching) != 1:
    fail('Uygulama imza sertifikası private key ile Keychain içinde bulunamadı veya birden fazla eşleşme var.')
certificate_sha = matching[0].split()[1].upper()
if certificate_sha not in {hashlib.sha1(cert).hexdigest().upper() for cert in profile.get('DeveloperCertificates', [])}:
    fail('Provisioning profili seçilen uygulama imza sertifikasını içermiyor.')
installer_identities = subprocess.check_output(['security', 'find-identity', '-v'], text=True)
if f'"{installer_identity}"' not in installer_identities or f'({team})' not in installer_identity:
    fail('Kurum ekibine ait installer sertifikası/private key Keychain içinde bulunamadı.')

destination = root / 'src-tauri/.appstore'
destination.mkdir(mode=0o700, exist_ok=True)
shutil.copyfile(profile_path, destination / 'embedded.provisionprofile')
sandbox = plistlib.loads((root / 'src-tauri/Entitlements.appstore.plist').read_bytes())
sandbox['com.apple.application-identifier'] = app_id
sandbox['com.apple.developer.team-identifier'] = team
if entitlements.get('keychain-access-groups'):
    # Keep the OS keychain-backed session store inside the app's own signed group.
    sandbox['keychain-access-groups'] = [app_id]
(destination / 'Entitlements.plist').write_bytes(plistlib.dumps(sandbox))
print('Mac App Store profili ve imza kimlikleri doğrulandı; sandbox entitlements hazır.')
