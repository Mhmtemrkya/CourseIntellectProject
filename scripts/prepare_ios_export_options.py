"""Prefer a matching local distribution profile when CLI account lookup fails."""
import datetime
import hashlib
import pathlib
import plistlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
options_path = root / 'mobile/ios/ExportOptions.plist'
options = plistlib.loads(options_path.read_bytes())
team = options['teamID']
bundle = 'com.schoolasist.app'
identities = subprocess.check_output(['security', 'find-identity', '-v', '-p', 'codesigning'], text=True)
signers = {sha.upper() for sha, name in re.findall(r'([A-Fa-f0-9]{40})\s+"([^"]+)"', identities)
           if name.startswith(('Apple Distribution:', 'iPhone Distribution:')) and f'({team})' in name}
profiles = []
folder = pathlib.Path.home() / 'Library/Developer/Xcode/UserData/Provisioning Profiles'
for path in folder.glob('*.mobileprovision'):
    result = subprocess.run(['security', 'cms', '-D', '-i', str(path)], capture_output=True)
    if result.returncode:
        continue
    profile = plistlib.loads(result.stdout)
    # Xcode refuses to use its managed profiles with signingStyle=manual.
    if profile.get('IsXcodeManaged'):
        continue
    entitlements = profile.get('Entitlements', {})
    if profile.get('TeamIdentifier') != [team] or entitlements.get('application-identifier') != f'{team}.{bundle}':
        continue
    if profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices') or entitlements.get('get-task-allow'):
        continue
    if entitlements.get('aps-environment') != 'production' or 'iOS' not in profile.get('Platform', []):
        continue
    if profile.get('ExpirationDate', datetime.datetime.min) <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
        continue
    matching = sorted(signers.intersection(hashlib.sha1(cert).hexdigest().upper()
                                          for cert in profile.get('DeveloperCertificates', [])))
    if matching:
        profiles.append((profile['ExpirationDate'], profile['UUID'], matching[0]))

if not profiles:
    # Existing automatic flow can obtain a profile when Xcode's account is usable.
    print(options_path)
else:
    _, profile_uuid, signer_sha = max(profiles)
    options.update(signingStyle='manual', signingCertificate=signer_sha,
                   provisioningProfiles={bundle: profile_uuid})
    destination = root / 'mobile/build/ios/ExportOptions.local.plist'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(plistlib.dumps(options))
    print(destination)
