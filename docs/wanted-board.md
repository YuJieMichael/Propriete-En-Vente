# Anonymous wanted board / Recherches anonymes / 匿名求房卡

## English

`<WantedBoard lang={lang}/>` is the public `#recherches` route. `<WantedReview lang={lang}/>` belongs inside the verified staff workspace. Both use the existing Supabase client and authentication provider; no additional environment flag or browser secret is needed.

Apply `supabase/migrations/20261023155201_anonymous_wanted_board.sql` before deploying the frontend. The file was generated with the official Supabase CLI `migration new anonymous_wanted_board` command. The CLI-generated timestamp is not hand-written.

The first version supports a structured request, a preview and an unchecked publication consent. Database-verified email sign-in is required to submit or respond. Staff must satisfy the existing `private.is_staff()` session step-up before moderation. Cards remain pending until staff publishes them, expire from the public board after 90 days, and can be withdrawn by their owner. Withdrawal blocks new responses. Existing private responses remain available to their participants and verified staff; expiry is not automatic deletion of private records.

Public criteria are restricted to property type, one of 40 Québec municipalities, CAD budget range, optional minimum bedrooms and parking preference, purchase/rent and a fixed timeline. Rent budgets are monthly. There is no public free-text field, name, email, phone number or account identifier. The opaque card UUID identifies the card, not its owner. Staff notes and responses never appear in public projections. The owner can see private review notes.

An authenticated, email-verified seller/broker can send one private response per public request, optionally referencing any currently published property by its numeric reference. Referencing a property does not establish ownership or professional verification. Responses are visible to the sender, buyer and verified moderation staff. Response queries return the latest 100 authorized rows; the own-request history returns the latest 100 cards. The UI discloses these bounds. This version does not send notification emails: the interface explicitly tells buyers to return to **My requests** and senders to **My responses**. It is not a two-way conversation; a sender may choose to include contact details in their private message.

Limits are enforced transactionally in PostgreSQL: at most 3 active requests, 3 new requests per user per rolling day, and 10 responses per user per rolling day. A unique `(request_id,sender_id)` prevents repeat responses. UUID submission keys make unchanged retries idempotent. Staff decisions use revision checks and write audit events.

Both underlying tables are in the non-exposed `private` schema, have RLS enabled, and grant no table privileges to `anon` or `authenticated`. Exposed RPCs are `SECURITY INVOKER`, with explicit execute grants. Privileged helpers live in `private`, use `SECURITY DEFINER SET search_path=''`, qualify relations, and authorize every private action against `auth.uid()` and the confirmed database user. Anonymous schema usage only permits execution of the deliberately sanitized public-list helper; it does not grant any table or private-action access.

| RPC | Access / result |
| --- | --- |
| `list_wanted_requests(p_offset=0,p_city=null,p_type=null)` | Anonymous or authenticated; up to 31 sanitized public cards for a 30-card page |
| `get_my_wanted_requests()` | Verified user; up to 100 own cards with status, revision, review note and response count |
| `create_wanted_request(p_id,p_card,p_consent)` | Verified user; validates explicit consent and strict criteria; returns UUID |
| `withdraw_wanted_request(p_id)` | Owner only; idempotent withdrawal |
| `send_wanted_reply(p_id,p_request_id,p_message,p_listing_number=null)` | Verified user; one private response, 10–1500 characters |
| `list_wanted_replies(p_request_id=null)` | Null returns own sent responses; a card UUID returns only authorized responses for that card |
| `list_wanted_review(p_status='pending',p_offset=0)` | Verified staff; up to 31 cards |
| `review_wanted_request(p_id,p_revision,p_decision,p_note='')` | Verified staff; publish/reject, revision-checked; note max 1000 characters |

Validation: `node supabase/tests/run-wanted-board.mjs` runs the real migration in disposable PGlite with authentication/storage test doubles and asserts role privacy, consent/allowlists, moderation, idempotency, expiration, limits, private responses and withdrawal. From `frontend/`, `node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 tests/wanted-board.test.tsx` exercises the public UI, consent, private view, withdrawal confirmation, staff gating and account-switch race. These tests do not create production users or sample public cards.

## Français

La route `#recherches` affiche des critères anonymes après modération. Un compte avec courriel confirmé est nécessaire pour créer une recherche ou répondre. La publication exige un consentement non coché par défaut. La recherche expire après 90 jours et son propriétaire peut la retirer. Les réponses restent privées entre l’acheteur, leur auteur et le personnel vérifié. Aucun courriel de notification n’est envoyé : les utilisateurs doivent consulter **Mes recherches** ou **Mes réponses**. Les données privées ne sont pas automatiquement supprimées à l’expiration.

Déployer la migration avant le frontend. Les RPC exposés sont exécutés avec les droits de l’appelant; les contrôles et projections autorisées sont dans le schéma privé. Aucun identifiant du compte, courriel, note de modération ou message n’est transmis dans la liste publique.

## 中文

`#recherches` 为公开求房卡入口。已验证邮箱的用户可以预览结构化条件，并主动勾选同意后提交；工作人员审核通过才公开。卡片 90 天后停止公开，买家可提前撤回，撤回后禁止新回复。公开字段不包含自由文本、账号身份或联系方式。

回复仅买家、回复者和通过验证的审核人员可见。本版不发送通知邮件，也不提供双向聊天；页面明确提示买家到“我的求房”、回复者到“我发出的回复”查看。回复者可自行选择是否在私密消息中留下联系方式。到期不等于自动删除私密记录。
