"""Validate the current build's exported App Store IPA without exposing secrets."""
import datetime
import pathlib
import plistlib
import subprocess
import sys
import tempfile
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
build_number = sys.argv[1]
build_started = int(sys.argv[2])
ipas = list((root / 'mobile/build/ios/ipa').glob('*.ipa'))
for ipa in ipas:
    if ipa.stat().st_mtime < build_started:
        continue
    with zipfile.ZipFile(ipa) as archive:
        info_paths = [n for n in archive.namelist()
                      if n.startswith('Payload/') and n.count('/') == 2 and n.endswith('/Info.plist')]
        if len(info_paths) != 1:
            continue
        info = plistlib.loads(archive.read(info_paths[0]))
        if str(info.get('CFBundleVersion')) != build_number:
            continue
        if info.get('CFBundleIdentifier') != 'com.schoolasist.app':
            sys.exit('HATA: IPA bundle identifier SchoolAsist ile eşleşmiyor.')
        with tempfile.TemporaryDirectory(prefix='schoolasist-ipa-') as tmp:
            archive.extractall(tmp)
            app = pathlib.Path(tmp) / info_paths[0].rsplit('/', 1)[0]
            subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
            metadata = subprocess.run(['codesign', '-dv', '--verbose=4', str(app)], capture_output=True, text=True, check=True).stderr
            if not any(f'Authority={name}:' in metadata for name in ['Apple Distribution', 'iPhone Distribution']):
                sys.exit('HATA: IPA Apple Distribution sertifikasıyla imzalanmamış.')
            if 'TeamIdentifier=RM53R2ZT6Q' not in metadata:
                sys.exit('HATA: IPA imzasının ekip kimliği eşleşmiyor.')
            signature = subprocess.run(['codesign', '-d', '--entitlements', ':-', str(app)],
                                       capture_output=True, check=True)
            entitlements = plistlib.loads(signature.stdout)
            profile = plistlib.loads(subprocess.check_output(
                ['security', 'cms', '-D', '-i', str(app / 'embedded.mobileprovision')]))
            checks = [
                (profile.get('TeamIdentifier') == ['RM53R2ZT6Q'], 'Yanlış Apple ekibi'),
                (profile['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), 'Profil süresi dolmuş'),
                (not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices'), 'App Store profili değil'),
                (not profile['Entitlements'].get('get-task-allow'), 'Geliştirme profili'),
                (not entitlements.get('get-task-allow'), 'Geliştirme imzası'),
                (entitlements.get('application-identifier') == 'RM53R2ZT6Q.com.schoolasist.app', 'Yanlış uygulama kimliği'),
                (entitlements.get('aps-environment') == 'production', 'APNs production değil'),
                ((app / 'PrivacyInfo.xcprivacy').is_file(), 'Gizlilik manifesti eksik'),
            ]
            for valid, message in checks:
                if not valid:
                    sys.exit('HATA: ' + message)
        print(f'İmzalı TestFlight IPA doğrulandı: {ipa}')
        sys.exit(0)
sys.exit('HATA: Bu build numarasına ait imzalı IPA bulunamadı. Archive tek başına TestFlight paketi değildir.')
