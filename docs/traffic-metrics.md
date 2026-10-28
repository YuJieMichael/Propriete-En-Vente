# Traffic and acquisition / Trafic et acquisition / 流量与获客

## English

The verified staff workspace has **Traffic and enquiries**, reading the existing `get_traffic_summary(p_days)` RPC for 7, 14 or 28 days. The public frontend cannot read the underlying private tables. The dashboard counts recorded site entries, property views and confirmed enquiry records. It does not count unique people, assess lead quality or report sales. Missing days are labelled as days without records, not evidence of zero visitors. The most recent event is not an ingestion-health heartbeat.

The frontend records only `{event, source, reference}` to the existing `record-traffic` Edge Function. Its fixed public origin, browser-safe API-key gate, bounded JSON validation and rate limits remain in place. Staff browsing, private account routes, previews, Do Not Track and Global Privacy Control are excluded from automatic browser events. A bounded tab ledger deduplicates a visit and up to 100 property references within a fixed 30-minute window. The ledger and channel context contain no account identifier, contact information, full URL or search sentence. Storage failure uses an in-memory fallback; counts remain approximate and may include internal QA or blocked/missing browser events.

The enquiry form sends a normalized `analyticsSource` separately from customer content. That value is captured when a new idempotent attempt is created and remains fixed on retry. The existing deployed `submit-enquiry` calls `collect_enquiry_with_metrics`; the browser cannot create an `enquiry_success` event. Successful enquiries are operational records and are counted by the server once per accepted UUID, including enquiries with an unknown source. Source is client-reported context, not verified advertising attribution.

Channel capture accepts fixed platform names and a few explicit aliases, recognizes only exact/subdomain referrer hosts, and uses a 30-minute tab context. The campaign link builder targets only the official hotel category in English, French or Chinese with `utm_campaign=hotel-20261028`. Facebook posts and groups are combined as `facebook`; cooperation links use `other`. Medium/campaign are finite link labels, not database breakdown dimensions. No third-party advertising pixel, analytics subscription or new persistent tracking identifier is added.

The restored backend files mirror the existing deployed collector/intake sources. This release does not require a database schema change or an Edge Function redeploy. Do not replace existing live functions with older untracked source. Production collection still depends on the already-provisioned `record_site_metric`, `collect_enquiry_with_metrics`, `get_traffic_summary` and private traffic tables. The disposable database regression suite does not create those pre-existing production-only metrics objects; ingestion handlers and dashboard/client contracts have separate tests. Local previews do not write production visit events. Private Search Console baselines stay in local task outputs rather than the public repository. Search Console is viewed separately; its search impressions are not website visit counts.

## Français

L’espace du personnel vérifié affiche les événements enregistrés par source, jour et référence d’annonce. Les jours sans données ne prouvent pas l’absence de visiteurs. Le comptage distingue les visites et consultations automatiques des demandes confirmées par le serveur. Les liens de campagne pointent vers la rubrique hôtels/motels; les publications d’une même plateforme sont regroupées. Aucun pixel publicitaire ni nouvel identifiant persistant n’est ajouté. Les sources du collecteur déjà déployé sont conservées dans le dépôt, sans modification du schéma ni redéploiement requis. Les données Search Console restent consultées séparément.

## 中文

已验证团队可在后台“流量与咨询”查看按平台来源、日期和房源汇总的记录次数。无记录日期不等于零访客，也不代表采集器健康；本版不统计独立访客、有效线索评级或成交。浏览器仅上报事件类型、规范来源和公开房源编号，私人账号页面、内部团队浏览、本地预览及开启DNT/GPC时不自动上报。

来源在当前标签页内使用，归因与去重窗口为30分钟。成功咨询由既有服务器接口按请求UUID计数，浏览器不能直接伪造成功事件。推广链接按平台归因，同一平台的不同帖子或群合并；medium和campaign标签不是独立数据库维度。不增加付费分析服务或广告像素。Google Search Console 的真实基线保存在本地任务输出中，不提交公开仓库；搜索曝光需在Search Console单独查看。
