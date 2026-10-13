#!/usr/bin/env bash
set -euo pipefail
echo "SchoolAsist: com.schoolasist.app / Team RM53R2ZT6Q"
if security find-identity -v -p codesigning | rg -q 'Apple Distribution:.*\(RM53R2ZT6Q\)|iPhone Distribution:.*\(RM53R2ZT6Q\)'; then
  echo "Apple Distribution sertifikası ve private key mevcut. App Store provisioning profilini Xcode export sırasında doğrulayın."
else
  echo "Apple Distribution sertifikası/private key bulunamadı. Xcode > Settings > Accounts > Team RM53R2ZT6Q > Manage Certificates üzerinden eklenmeli."
  exit 1
fi
