# Property models

The property catalogue supports reviewed, self-contained GLB models alongside existing Matterport and Kuula tours. Each model can describe an interior or exterior scene. The viewer and model file load only after a visitor clicks **Open the 3D model**. Visitors can rotate, zoom, reset the view, switch scenes and expand the viewer. No AR, camera or location permission is requested.

The demonstration at `/fr/#visite-3d`, `/en/#visite-3d` and `/zh/#visite-3d` uses two original fictional models. It does not represent a published property and stays outside the sitemap. The footer links to this experience. Regenerate its assets with `node scripts/generate-model-demos.mjs`.

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
      "illustrative": false
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

## Modèles immobiliers

Le catalogue accepte des modèles GLB autonomes vérifiés, pour l’intérieur et l’extérieur, en complément des visites Matterport et Kuula. Le chargement démarre sur demande. Les modèles de démonstration sont fictifs et ne sont associés à aucune annonce. Les fichiers de modèle sont publics : les éléments confidentiels doivent être examinés avant publication.

## 房源模型

网站可展示经核实的室内、室外 GLB 模型，支持旋转、缩放、恢复视角、全屏及场景切换。模型按需加载。模型重建需另行完成，网站不会把普通照片自动变成模型。演示模型为虚构场景，没有绑定编号100045或其他真实房源；目前由管理员按既有发布流程关联模型，普通卖家表单尚不提供模型上传。
