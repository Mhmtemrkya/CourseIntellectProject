#!/usr/bin/env python3
"""Prepare two operator-provisioned accounts; never connects to a server or sends email.
Outputs are private files outside the repository. Passwords are never printed.
"""
import argparse, base64, hashlib, json, os, re, secrets, string, uuid
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--email', action='append', required=True)
parser.add_argument('--output-dir', type=Path, required=True)
args = parser.parse_args()
emails = [x.strip().lower() for x in args.email]
if len(emails) != 2 or len(set(emails)) != 2 or any(not re.fullmatch(r'[a-z0-9._+\-]+@[a-z0-9.\-]+\.[a-z]{2,}', x) or len(x) > 80 for x in emails):
    parser.error('Provide exactly two distinct email addresses, each at most 80 characters.')
repo = Path(__file__).resolve().parents[2]
output = args.output_dir.resolve()
if output == repo or repo in output.parents:
    parser.error('Credential output must be outside the repository.')
os.umask(0o077)
output.mkdir(mode=0o700, parents=True, exist_ok=False)
chars = string.ascii_letters + string.digits + '!@#$%*-_=+'
passwords = []
for _ in emails:
    while True:
        candidate = ''.join(secrets.choice(chars) for _ in range(20))
        if candidate not in passwords and all(any(c in group for c in candidate) for group in (string.ascii_lowercase, string.ascii_uppercase, string.digits, '!@#$%*-_=+')):
            passwords.append(candidate); break

def private_write(name, content):
    fd = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as file: file.write(content)

def quote(value): return "'" + value.replace("'", "''") + "'"
hashes = []
for password in passwords:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600_000, 32)
    hashes.append('600000.' + base64.b64encode(salt).decode() + '.' + base64.b64encode(digest).decode())
private_write('yonetici-sifreleri.txt', 'SchoolAsist yönetici giriş bilgileri\nHenüz canlıya uygulanmadı.\n\n' + '\n\n'.join(f'E-posta: {email}\nŞifre: {password}' for email,password in zip(emails,passwords)) + '\n')
private_write('admin-email.env', 'AdminAccess__Mode=EmailCode\nAdminAccess__Host=yonetim.schoolasist.com\nAdminAccess__AllowedEmails=' + ','.join(emails) + '\n')
rows = ',\n'.join('(' + ','.join(map(quote,(str(uuid.uuid4()),email,hashed))) + ')' for email,hashed in zip(emails,hashes))
sql = '''-- Contains salted password hashes, no plaintext passwords. Keep mode 0600.
-- Apply only AFTER MFA migrations, release backup, SMTP and management TLS readiness.
\\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE provisioned_managers (id uuid, email text, password_hash text) ON COMMIT DROP;
INSERT INTO provisioned_managers VALUES
''' + rows + ''';
DO $provision$
BEGIN
  IF EXISTS (SELECT 1 FROM provisioned_managers p WHERE
    (SELECT count(*) FROM users u WHERE lower(u."Username")=p.email)>1)
  OR EXISTS (SELECT 1 FROM users u JOIN provisioned_managers p ON lower(u."Username")=p.email
    WHERE u.tenant_id IS NOT NULL OR u."PrimaryRole"<>7 OR u."Status"<>1) THEN
    RAISE EXCEPTION 'Existing username collision is not an active tenant-free platform account. No change made.';
  END IF;
END $provision$;
UPDATE users u SET "PasswordHash"=p.password_hash, "PlatformAccessEmail"=p.email,
  "must_change_password"=false, temporary_password_expires_at_utc=NULL,
  "AdminMfaVersion"=u."AdminMfaVersion"+1, security_version=u.security_version+1
FROM provisioned_managers p WHERE lower(u."Username")=p.email;
INSERT INTO users ("Id","FullName","Username","PasswordHash","PrimaryRole","Status","Campus",
  "DepartmentOrBranch","TcNo","PhotoUrl","IsEmailVerified",must_change_password,security_version,
  "PlatformAccessEmail","AdminMfaVersion","CreatedAtUtc",extra_roles,role_history)
SELECT p.id,'Platform yöneticisi',p.email,p.password_hash,7,1,'','','','',false,false,1,p.email,0,now(),'','[]'
FROM provisioned_managers p WHERE NOT EXISTS (SELECT 1 FROM users u WHERE lower(u."Username")=p.email);
UPDATE refresh_token_sessions s SET "RevokedAtUtc"=now() FROM users u,provisioned_managers p
WHERE s."UserId"=u."Id" AND lower(u."Username")=p.email AND s."RevokedAtUtc" IS NULL;
DELETE FROM admin_mfa_challenges c USING users u,provisioned_managers p
WHERE c."UserId"=u."Id" AND lower(u."Username")=p.email;
COMMIT;
'''
private_write('provision-managers.sql', sql)
print('Prepared two distinct 20-character passwords and private provisioning files. Nothing deployed or emailed.')
