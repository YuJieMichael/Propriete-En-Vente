# Property models

The property catalogue supports reviewed, self-contained GLB models alongside existing Matterport and Kuula tours. Each model can describe an interior or exterior scene. The viewer and model file load only after a visitor clicks **Open the 3D model**. Visitors can rotate, zoom, reset the view, switch scenes and expand the viewer. A larger viewport and closer default framing make details easier to inspect. Optional numbered photo points follow the model as it rotates; selecting one opens its associated images in the existing photo viewer. A labelled list below the stage makes every point accessible regardless of camera direction. Closing the photos preserves the camera view and returns focus to the selected point. No AR, camera or location permission is requested.

The demonstration at `/fr/#visite-3d`, `/en/#visite-3d` and `/zh/#visite-3d` uses two original fictional models and two AI-generated concept illustrations under `/models/demo/photos/`. They are labelled as illustrative and are not attached to a real listing. It stays outside the sitemap. The footer links to this experience. Regenerate its GLB assets with `node scripts/generate-model-demos.mjs`; this does not regenerate or overwrite the illustrations.

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

Each scene accepts up to twelve photo points and eight unique photos per point. Positions are finite `[x,y,z]` coordinates in the GLB's meter coordinate system; normals contain components from -1 to 1 and must be nonzero. Place and review them against the final exported model, for example with the official model-viewer hotspot editor. IDs are unique within a scene, and labels require English, French and Chinese translations. Photos must use reviewed `/centris/.../001.webp`, `/editorial/.../001.webp` paths or a nested `/models/.../photos/name.webp` (also `.jpg` and `.png`) path. Remote and signed private upload URLs are not supported. Review these public images before release. Invalid points are omitted without hiding the model. Point illustrations default to `true`; an illustrative scene always keeps its photo disclosure even if an individual point requests `false`. A verified model without photos remains fully usable with no empty photo list.

## Modèles immobiliers

Le catalogue accepte des modèles GLB autonomes vérifiés, pour l’intérieur et l’extérieur, en complément des visites Matterport et Kuula. Le chargement démarre sur demande. La zone 3D agrandie et les points photo numérotés permettent d’inspecter un espace puis d’ouvrir ses images. Les modèles de démonstration et les illustrations IA sont fictifs et ne sont associés à aucune annonce. Les fichiers de modèle et leurs photos sont publics : les éléments confidentiels doivent être examinés avant publication.

## 房源模型

网站可展示经核实的室内、室外 GLB 模型，支持旋转、缩放、恢复视角、全屏及场景切换。模型区域已扩大，点击编号点位可打开对应位置的图片，关闭后保留原视角。模型按需加载。模型重建需另行完成，网站不会把普通照片自动变成模型。演示模型与AI示意图没有绑定编号100045或其他真实房源；目前由管理员按既有发布流程关联模型及点位图片，普通卖家表单尚不提供模型上传。
