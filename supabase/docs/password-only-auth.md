# Password-only authentication

Accounts sign in with email and password. Password recovery uses the latest
emailed recovery link and matching new passwords, with no additional code.
Signup email confirmation remains enabled.

The application no longer enrolls or challenges MFA factors. Staff authorization
still requires a confirmed account and active server-managed owner/operator
membership. The invitation endpoint verifies the JWT and Auth identity and
requires an active owner. User metadata cannot grant staff access.

Production rollout:

1. Disable TOTP enrollment and verification in the project's Auth MFA settings;
   keep phone MFA disabled and disable the AAL1 time limit for MFA users.
2. Remove all existing Auth MFA factors, including verified factors, and verify
   the remaining count is zero. Do not alter passwords, users or staff membership.
3. Apply `password_only_staff_access`, deploy `invite-staff`, and release the
   frontend from the Cloudflare deployment branch.
4. Verify deployed assets and password recovery. Real account password entry
   remains with the account holder.

Old email-verification functions and private records are retained for audit
compatibility; they no longer grant or gate staff access.

## Français

Connexion par courriel et mot de passe, réinitialisation par lien envoyé par
courriel. Aucun code supplémentaire n'est demandé. Les droits administrateur
restent limités aux membres actifs avec une adresse courriel confirmée.
