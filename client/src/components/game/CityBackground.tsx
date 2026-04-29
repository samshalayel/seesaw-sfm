/**
 * CityBackground.tsx — Cartoon City (120×150م أصلي)
 *
 * CITY_SCALE=2 → 240×300م
 * CITY_CENTER_X=-4, CITY_CENTER_Z=180
 * city local = (world - center) / scale
 *
 * Company group at world(-20,0,200) rotated PI around Y
 * x_world = -20 - local_x  |  z_world = 200 - local_z
 *
 * PerimeterWall local X[-30,22] Z[-35,14]:
 *   world X: [-42, 10]  → city local X: (-42+4)/2=-19 → (10+4)/2=7  → [-20, 7]
 *   world Z: [186, 235] → city local Z: (186-180)/2=3 → (235-180)/2=27.5 → [3, 28]
 *
 * Front approach (local Z 14→55):
 *   world Z: [145, 186] → city local Z: [-17.5, 3] → [-18, 3]
 *   city local X: same [-20, 7]
 */

import * as THREE from "three";
import { useEffect, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const CITY_SCALE    = 2;
const CITY_CENTER_X = -4;
const CITY_CENTER_Z = 180;
// company moved to Z=214

// بعد التدوير PI/2 + Z=190.5: x_world=-20-local_z | z_world=190.5+local_x
// PerimeterWall [-30,22]×[-35,14] → world X[-34,15] Z[160.5,212.5]
// city local X: ([-34,15]+4)/2 = [-15, 9.5] → [-16, 10]
// city local Z: ([160.5,212.5]-180)/2 = [-9.75, 16.25] → [-10, 17]
const COMPANY_X_MIN = -16;
const COMPANY_X_MAX =  10;
const COMPANY_Z_MIN = -10;
const COMPANY_Z_MAX =  17;

// ممر الاقتراب (local Z[14,60]) → world X[-80,-34], world Z=same
const FRONT_X_MIN = -38;
const FRONT_X_MAX = -15;
const FRONT_Z_MIN = -10;
const FRONT_Z_MAX =  17;

// بصمة المبنى فقط (local X[-24,16] Z[-29,8]) → city local X[-12,6.5] Z[-6.75,13.25]
// نستخدم الاحتواء الكامل لتجنب إخفاء بلاطات تمتد خارج المبنى
const BUILD_X_MIN = -12;
const BUILD_X_MAX =  6.5;
const BUILD_Z_MIN =  -6.75;
const BUILD_Z_MAX =  13.25;

export function CityBackground() {
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      "/models/cartoon_city.glb",
      (gltf) => {
        const scene = gltf.scene;

        // ── الظلال ────────────────────────────────────────────────────────
        scene.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow    = true;
            c.receiveShadow = true;
          }
        });

        // ── توسيط على X/Z ─────────────────────────────────────────────────
        const box0   = new THREE.Box3().setFromObject(scene);
        const center = new THREE.Vector3();
        box0.getCenter(center);
        scene.position.set(-center.x, 0, -center.z);

        // ── تحطيط المباني الطائرة ─────────────────────────────────────────
        scene.children.forEach((child) => {
          const cb = new THREE.Box3().setFromObject(child);
          if (cb.min.y > 0.05) child.position.y -= cb.min.y;
        });

        // ── تأكيد أن الكل فوق y=0 ────────────────────────────────────────
        const finalBox = new THREE.Box3().setFromObject(scene);
        scene.position.y = -finalBox.min.y;

        const size = new THREE.Vector3();
        finalBox.getSize(size);
        console.log(
          `✅ CityBackground  أصلي: ${size.x.toFixed(0)}×${size.z.toFixed(0)}م` +
          `  مكبّر×${CITY_SCALE}: ${(size.x*CITY_SCALE).toFixed(0)}×${(size.z*CITY_SCALE).toFixed(0)}م`
        );

        // ── تحديث مصفوفات العالم قبل حساب حدود الـ bounding boxes ────────
        scene.updateMatrixWorld(true);

        // ── إخفاء مباني المدينة التي تتعارض مع بصمة الشركة أو ممر الاقتراب ─
        let hiddenCount = 0;
        scene.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;

          const cb = new THREE.Box3().setFromObject(child);
          const height = cb.max.y - cb.min.y;

          const inCompanyX = cb.max.x > COMPANY_X_MIN && cb.min.x < COMPANY_X_MAX;
          const inCompanyZ = cb.max.z > COMPANY_Z_MIN && cb.min.z < COMPANY_Z_MAX;
          const inFrontX   = cb.max.x > FRONT_X_MIN   && cb.min.x < FRONT_X_MAX;
          const inFrontZ   = cb.max.z > FRONT_Z_MIN   && cb.min.z < FRONT_Z_MAX;

          // بصمة المبنى — احتواء كامل (tile must be FULLY inside building bounds)
          // يمنع إخفاء بلاطات كبيرة تمتد خارج المبنى وتُظهر خلفية سوداء
          const inBuilding = cb.min.x >= BUILD_X_MIN && cb.max.x <= BUILD_X_MAX
                          && cb.min.z >= BUILD_Z_MIN && cb.max.z <= BUILD_Z_MAX;

          // داخل المبنى: أخفِ كل شيء حتى تظهر أرضيات الغرف
          if (inBuilding) {
            child.visible = false;
            hiddenCount++;
            return;
          }

          // خارج المبنى: أخفِ المباني الطويلة فقط (نبقي الرصيف)
          if (height < 1.5) return;
          if ((inCompanyX && inCompanyZ) || (inFrontX && inFrontZ)) {
            child.visible = false;
            hiddenCount++;
          }
        });
        console.log(`🏙️ CityBackground: أُخفي ${hiddenCount} mesh`);
        // إخفاء السيارة الناقصة (Futuristic_Car_1 instance 001 — مقطوعة بسبب حدود المبنى)
        scene.traverse((c) => {
          if ((c as THREE.Mesh).isMesh && /Futuristic_Car_1.*001/i.test(c.name))
            c.visible = false;
        });


        setModel(scene);
      },
      undefined,
      (err) => console.error("❌ ciudad.glb", err)
    );
  }, []);

  if (!model) return null;

  return (
    <group
      position={[CITY_CENTER_X, 0, CITY_CENTER_Z]}
      scale={[CITY_SCALE, CITY_SCALE, CITY_SCALE]}
    >
      <primitive object={model} />
    </group>
  );
}
