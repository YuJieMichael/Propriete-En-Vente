# Business information requests

## English

Real hotel/motel and daycare property pages now have a compact, initially collapsed business-information panel plus a confidential-document request link. It displays only existing published facts: explicit `guestRooms` (including any source estimate qualifier), daycare `capacity`, subsidy status, `includedBuilding`, published parking count and lot area. Unknown values remain to confirm. Bedrooms, commercial-unit counts and asking price cannot establish guest-room capacity. No approximate counts, occupancy or revenue values have been fabricated.

The document list describes information a buyer can ask the team to confirm, not files already available. Availability and sharing scope remain subject to owner approval. Financial reports, hotel occupancy, daycare enrolment, leases and authorizations are **not** stored in the public property JSON or shipped as hidden browser data by this feature.

The `intent=nda` route preserves the property reference and language through navigation/reload. It opens the existing buyer intake with clear manual-review wording. On explicit submission, a bounded `[NDA]` prefix is added to the existing `requirements` field; the original collection endpoint, server property association, staff access, rate limits, per-enquiry notification and CSV export are reused. Staff see a manual-review label. No signed-NDA flag is accepted or created, and no files are unlocked.

### Staff workflow

1. Open the NDA-labelled enquiry and verify its associated property.
2. Confirm which documents the owner authorizes, their availability, and which NDA applies.
3. Obtain and verify the signed NDA outside this public form; record the signature evidence using the team's approved private process.
4. Provide only the authorized documents through the team's approved private channel. Do not paste financial reports, identity records, child/client/staff details or document URLs into public listing features.

The existing Accept action is enquiry triage only. It does not mean an NDA has been executed or that document access has been approved. This release does not provide e-signature, a private document portal, document upload or automatic approval.

Tests cover published/estimated/unknown capacity, daycare facts, exclusion of demo/residential listings, explicit validated request intent, trilingual form copy and submitted payloads, and NDA labelling in the inbox. Browser QA checks mobile width, expanding the panel, property-reference handoff and reload. No live test enquiry is submitted.

## Français

Les annonces réelles d’hôtels/motels et de garderies disposent d’un volet compact contenant uniquement les données déjà publiées. Les valeurs inconnues restent à confirmer. Le lien de demande conserve l’annonce et ouvre le formulaire existant; le personnel reçoit un repère `[NDA]`. La signature, la vérification de l’entente et le partage autorisé demeurent manuels. Accepter une demande dans la boîte ne signe aucune entente et n’accorde aucun accès aux documents.

## 中文

酒店／汽车旅馆及托儿所页面新增可收起的经营资料区，展示已有公开参数；缺失的客房数、名额等保留待确认，不凭价格或商业单元数推算。保密资料入口沿用现有咨询系统，后台与 CSV 可识别 `[NDA]` 申请。团队先确认业主授权范围、人工核验已签署 NDA，再通过获批准的私密渠道提供资料。后台“通过”仅表示咨询处理状态，不代表 NDA 已签署或资料获准公开。本次未建立在线签署、文件上传或自动解锁功能。
