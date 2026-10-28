# Hotel acquisition entry / Projet hôtelier / 酒店收购入口

## English

This change focuses the existing hotel/motel category on a buyer's next step. It does not redesign the site, change its French default, add inventory, reorder recommendations or promise investment results. It adds no paid service, external image, mailing or outreach action.

- Category: `/{lang}/proprietes/hotels-motels/`.
- Insert `<HotelAcquisitionIntro lang={lang}/>` after the existing category heading and description, before catalogue controls and listings.
- The intro has one primary action: describe a hotel acquisition search. It asks visitors to think about acquisition budget, cities/regions and timing, and explains that their request is private and needs no new account.
- The existing `<CategoryGuide lang={lang} type="hotel-motel"/>` becomes supporting guidance without an additional action. Other categories keep their existing general search links.
- Copy and form link are exported from the framework-free `frontend/src/hotel-acquisition-copy.ts`, so the static SEO generator can use exactly the same action and wording.

The form link contract is:

```text
/{lang}/#acheter?propertyType=hotel-motel&intent=hotel-acquisition
```

The root router/form integration must validate these allowlisted parameters, preselect `hotel-motel`, and retain the existing consent and real submission flow. `intent=hotel-acquisition` describes the form's purpose; it is not a traffic channel and must not replace the session's independently captured source. No name, email, budget, region, free-text question or other private information belongs in this link. The CTA has `data-acquisition-entry="hotel"` as a stable event hook. Campaign/share URLs are owned by the separate `lib/campaign-links.ts` helper and are not generated here.

The root static SEO generator should include the intro and the same specialized form link for hotel categories; otherwise an unhydrated visitor would receive a general link rather than the matching hotel intent. The shared `seo-content.json` updates only the hotel entries in English, French and Chinese. Existing category titles, URLs, inventory rendering, canonical/hreflang rules and other categories remain intact.

Copy describes actual workflow and useful search criteria. It does not claim that listed properties have been newly verified, that the team has a specific mandate, that an acquisition includes a building/business/land, or that a seller response or match is guaranteed. Inclusion scope and missing room/season/maintenance details are framed as questions to clarify. No stock inventory counts, prices, property photos or income estimates are embedded in the component.

Checks from `frontend/`:

```text
node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 tests/hotel-acquisition.test.tsx tests/listing-categories.test.tsx tests/seo.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

The component tests check three-language content, exactly one hotel action, allowlisted public intent parameters, truthful metadata alignment, and unchanged general links for other categories. The root integration additionally needs to verify actual hotel prefill, source continuity and a real backend submission separately.

## Français

La catégorie existante hôtels/motels présente un seul prochain geste : **Décrire mon projet hôtelier**. Le visiteur prépare son budget, ses régions et son échéancier, puis transmet une demande privée sans créer de compte. Les annonces et leur ordre restent ceux du catalogue. Le guide explique les renseignements à préciser et le suivi de la demande, sans promesse de rendement, de correspondance ou de réponse d’un vendeur.

Le paramètre `propertyType=hotel-motel` sert au préremplissage. `intent=hotel-acquisition` indique le but du formulaire et ne remplace pas la provenance de la visite. Le texte d’introduction, le lien et les métadonnées existent aussi en anglais et en chinois; le français demeure la langue par défaut.

## 中文

本次只强化现有酒店／汽车旅馆分类入口，不重做全站。页面围绕预算、目标地区和计划时间，引导访客点击唯一主行动“填写酒店收购需求”。需求私密提交给网站团队，提交无需创建账号。房源数量、价格、排序和照片均由现有目录提供，组件不写死库存或编造收益。

`propertyType=hotel-motel` 用于预填物业类型，`intent=hotel-acquisition` 仅表示表单用途，不替代访客渠道来源。根任务负责路由、表单预填、静态 HTML 同步、真实提交和发布验证；本组件任务不发送邮件、不发帖、不修改数据库。
