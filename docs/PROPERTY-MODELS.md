# Property models

The property catalogue supports reviewed, self-contained GLB models alongside existing Matterport and Kuula tours. Each model can describe an interior or exterior scene. The viewer and model file load only after a visitor clicks **Open the 3D model**. Visitors can rotate, zoom, reset the view, switch scenes and expand the viewer. A larger viewport and closer default framing make details easier to inspect. Optional numbered photo points follow the model as it rotates; selecting one opens its associated images in the existing photo viewer. A labelled list below the stage makes every point accessible regardless of camera direction. Closing the photos preserves the camera view and returns focus to the selected point. No AR, camera or location permission is requested.

The experience at `/fr/#visite-3d`, `/en/#visite-3d` and `/zh/#visite-3d` opens with a worked example from published reference **100021**, 104 Rue Olivier, Laurier-Station (source 24397299). Its three small, self-contained models illustrate the exterior/parking, a two-bed guest room and a bathroom. Geometry and visible finishes follow the available listing photos, including the existing aerial photo. No Google Maps imagery, invented room number, measured scale or connected interior floor plan is used. Interior examples do not imply a particular floor or location within the building. Points open the existing, unchanged real photos from the listing, with source credit. No price or other listing fact is changed, and no model is inserted in the database or assigned to the listing as a verified tour. The matching original property page links to the explicitly schematic case. Regenerate these models with `node scripts/generate-motel-example.mjs`.

A separate **Fictional demonstration** choice retains the two original fictional models and two AI-generated concept illustrations under `/models/demo/photos/`. They stay separate from the real-photo case and are not attached to a real listing. The experience remains outside the sitemap and the footer links to it. Regenerate the fictional GLB assets with `node scripts/generate-model-demos.mjs`; this does not regenerate or overwrite the illustrations.

## Add a verified model to a listing

1. Obtain the authorized real model from a scan, photogrammetry workflow or a reviewed floor-plan model. Photos alone are not converted by this website. Review the geometry, permitted audience and any identifying details before publication.
2. Export a self-contained `.glb` with embedded textures. Use uncompressed geometry for the simplest deployment; the built-in viewer is not a Gaussian-splat or point-cloud converter. Prefer files below 25 MB and test on a phone.
3. Add the file under `frontend/public/models/<listing-reference>/`, using a versioned filename. These files are public; never put a confidential-address model here without authorization.
4. During an authorized publication update, attach `models` to the existing reviewed `property` JSON in both its submission and published projection. Keep its reference, contact information and other facts unchanged. This is an administrator-managed content update; the ordinary seller submission form and its validation do not upload models.
5. Release the asset and reader before publishing the new model references. Follow the repository PR, test and exact-commit deployment workflow. Verify every scene and its language labels on mobile and desktop.

```json
{
  "models": [
    {
      "src": "/models/100045/exterior-v1.glb",
      "area": "exterior",
      "label": {"fr": "Bâtiment", "en": "Building", "zh": "建筑外观"},
      "illustrative": false,
      "hotspots": [
        {
          "id": "entrance",
          "label": {"fr": "Entrée", "en": "Entrance", "zh": "入口"},
          "position": [0, 1.6, 1.9],
          "normal": [0, 0, 1],
          "photos": ["/models/100045/photos/entrance-v1.webp"],
          "illustrative": false
        }
      ]
    },
    {
      "src": "/models/100045/guest-room-v1.glb",
      "area": "interior",
      "label": {"fr": "Chambre", "en": "Guest room", "zh": "客房"},
      "illustrative": false
    }
  ]
}
```

This example is a configuration shape, not a model supplied for listing 100045. No model is automatically assigned to that listing. `illustrative` defaults to `true`; use `false` only for a verified representation of that property. Up to eight translated scenes are accepted. Unsafe paths, arbitrary external URLs, duplicates and malformed optional scenes are ignored, preserving the rest of the catalogue. Listings without valid models show no empty 3D section.

Each scene accepts up to twelve photo points and eight unique photos per point. Positions are finite `[x,y,z]` coordinates in the GLB's meter coordinate system; normals contain components from -1 to 1 and must be nonzero. Place and review them against the final exported model, for example with the official model-viewer hotspot editor. IDs are unique within a scene, and labels require English, French and Chinese translations. Photos must use reviewed `/centris/.../001.webp`, `/editorial/.../001.webp` paths or a nested `/models/.../photos/name.webp` (also `.jpg` and `.png`) path. Remote and signed private upload URLs are not supported. Review these public images before release. Invalid points are omitted without hiding the model. Point illustrations default to `true`; a fictional illustrative scene always keeps its photo disclosure even if an individual point requests `false`. A verified model without photos remains fully usable with no empty photo list.

Photo-based examples can explicitly set `illustrative: true, schematic: true`. This preserves a visible geometry notice stating that dimensions, room locations and connections are unverified, while allowing individually reviewed real-photo points to set `illustrative: false`. Without the exact boolean `schematic: true`, fictional illustration defaults stay unchanged. Do not use this flag to imply measurement or scan accuracy. The standalone example provides a real-photo source credit to the shared gallery. Existing verified-model and seller-submission workflows remain unchanged.

## Modèles immobiliers

Le catalogue accepte des modèles GLB autonomes vérifiés, pour l’intérieur et l’extérieur, en complément des visites Matterport et Kuula. Le chargement démarre sur demande. La zone 3D agrandie et les points photo numérotés permettent d’inspecter un espace puis d’ouvrir ses images. L’exemple 100021 utilise les photos réelles du motel de Laurier-Station et des modèles explicitement schématiques, sans dimensions ni liaisons vérifiées. La démonstration fictive et ses illustrations IA restent séparées. Les fichiers de modèle et leurs photos sont publics : les éléments confidentiels doivent être examinés avant publication.

## 房源模型

网站可展示经核实的室内、室外 GLB 模型，支持旋转、缩放、恢复视角、全屏及场景切换。模型区域已扩大，点击编号点位可打开对应位置的图片，关闭后保留原视角。现有实拍案例采用100021号房源的照片，分别制作外观、双床客房及浴室示意；尺寸、房间位置与连接关系未核实，不构成完整户型。点位图片为该房源已发布的原始实拍，虚构演示与AI示意图另行保留。模型按需加载。网站不会把普通照片自动变成模型；目前由管理员按既有发布流程关联模型及点位图片，普通卖家表单尚不提供模型上传。

## Generated schematic models (photo recognition + templates)

New listings can get photo-based schematic models without hand-written geometry:

1. **Recognise.** Classify each published listing photo by space (front exterior, driveway, rear balconies, yard, aerial, living area, kitchen, island, patio door, bedroom window, closet, shower, vanity, tub) and note visible features (storeys, wood cladding panel, front stair, rear balconies, number of sheds, island, high windows). Photos whose location is not shown (for example a laundry room) are not placed. Listings with only illustrations get no model.
2. **Describe.** Write `scripts/listing-models/specs/<reference>.json`: listing reference, source id, and per scene a template, observed parameters and the photos attached to each template anchor.
3. **Generate.** `node scripts/listing-models/generate.mjs [reference]` writes `frontend/public/models/<reference>/*.glb` and `frontend/src/generated-listing-models.json`, checking every photo exists.
4. **Review and publish.** Open a PR; merging it publishes the models. The listing page shows them only when both the reference and the source id match, and a model stored with the listing always wins. Every generated scene is `illustrative` and `schematic`, so the page states that dimensions, room positions and connections are unverified. Interior scenes are labelled as examples.

Templates (`scripts/listing-models/templates.mjs`): `plexExterior`, `openLivingKitchen`, `bedroom`, `bathroom`. Add a template before modelling a property type the existing ones do not fit (for example a motel block); do not force a mismatched template.

## Modèles schématiques générés

Les photos publiées d’une annonce sont classées par espace, puis un fichier de description (`scripts/listing-models/specs/<référence>.json`) choisit un gabarit par scène et rattache les photos aux points. `node scripts/listing-models/generate.mjs` produit les GLB et le registre lu par le site. La fusion de la PR vaut publication. Les scènes restent schématiques : dimensions, emplacements et liaisons non vérifiés. Une annonce sans photo réelle ne reçoit pas de modèle.

## 自动生成的示意模型

先把房源已发布的实拍照片按空间分类（外观、车道、后阳台、后院、航拍、客厅、厨房、岛台、推拉门、卧室窗、衣柜、淋浴、浴室柜、浴缸），并记录看得到的特征。照片看不出具体位置的（如洗衣间）不放进模型；只有示意图、没有实拍的房源不做模型。然后写描述文件 `scripts/listing-models/specs/<编号>.json`，运行 `node scripts/listing-models/generate.mjs` 生成模型和网站读取的登记表。提交 PR，合并即发布。所有生成的场景都标注为示意，尺寸、房间位置和连接关系未核实。
