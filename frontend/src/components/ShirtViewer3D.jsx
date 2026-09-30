/* eslint-disable react-hooks/immutability */

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import {
  Canvas,
  useFrame,
  useThree,
} from '@react-three/fiber';

import {
  OrbitControls,
  useGLTF,
} from '@react-three/drei';

import * as THREE from 'three';

import {
  applyPrintTextureProps,
  computeUvBounds,
  EDITOR_W,
  EDITOR_H,
} from '../lib/shirtTexture';

/* =========================================================
   MODELS
========================================================= */

const MODEL_URLS = {
  male: '/models/tshirt-male.glb',
  hoodie: '/models/hoodie.glb',
  hoodie_zip: '/models/hoodie_zip.glb',
  cap: '/models/cap_main.glb',
  tote: '/models/tote_main.glb',
};

// Per-model tweaks. Every model needs a FRONT_PRINT mesh or material;
// a BACK_PRINT one is optional and enables back-side printing.
//  rotationY:  turns the model so its front faces the camera (+Z).
//  printFit:   how the 326x500 editor canvas is laid onto a print surface:
//    'stretch'  whole canvas → whole surface (t-shirt: the surface already
//               has roughly the editor's proportions).
//    'squeeze'  whole canvas, narrowed horizontally by a printWidthBoost-
//               tuned amount (was used for the old hoodie_main.glb; kept
//               for models that need a hand-tuned fit).
//    'band'     a full-width horizontal band of the canvas, cut to the
//               surface's true proportions, covers the WHOLE surface. For
//               wide, short panels like a cap: designs keep their shape and
//               can fill the entire printable area.
//  fabricMaterial: name prefix of the garment's fabric material. When set,
//               every other non-print part (e.g. a zipper) is hardware: it
//               keeps HARDWARE_COLOR instead of taking the garment colour.
const MODEL_OPTIONS = {
  male: { rotationY: 0, printFit: 'stretch' },
  // hoodie.glb: front print ~27x25 cm, back ~22x31 cm.
  hoodie: { rotationY: 0, printFit: 'band' },
  // Front print is split around the zipper (merged on load, see
  // mergeSplitPrintPanels) into a wide ~34x27 cm area; back is ~22x31 cm.
  // The zipper meshes (Material429…) stay black whatever the fabric colour.
  hoodie_zip: { rotationY: 0, printFit: 'band', fabricMaterial: 'FABRIC' },
  // cap_main.glb is exported with its brim facing -Z, so turn it around.
  cap: { rotationY: Math.PI, printFit: 'band' },
  // tote_main.glb: square-ish front/back print panels, front faces +Z.
  tote: { rotationY: 0, printFit: 'band' },
};

const PRINT_MATERIAL_NAME = 'FRONT_PRINT';
const BACK_PRINT_MATERIAL_NAME = 'BACK_PRINT';

// Colour of non-fabric parts such as zippers (see MODEL_OPTIONS.fabricMaterial).
const HARDWARE_COLOR = '#000000';

// texture = a · canvas + b, per axis, in 0..1 units. Identity = 'stretch'.
const IDENTITY_MAPPING = { ax: 1, bx: 0, ay: 1, by: 0 };

// All garments are normalized to roughly the same visual size.
// This is UNIFORM scaling, so it never distorts the model.
const TARGET_MODEL_SIZE = 1.55;

useGLTF.preload(MODEL_URLS.male);
useGLTF.preload(MODEL_URLS.hoodie);
useGLTF.preload(MODEL_URLS.hoodie_zip);
useGLTF.preload(MODEL_URLS.cap);
useGLTF.preload(MODEL_URLS.tote);

/* =========================================================
   HELPERS
========================================================= */

function matchesPrintName(object, material, name) {
  const objectName = String(object?.name || '');
  const materialName = String(material?.name || '');

  return (
    objectName === name ||
    objectName.startsWith(`${name}.`) ||
    materialName === name ||
    materialName.startsWith(`${name}.`)
  );
}

// 'front' | 'back' | null
function printSideOf(object, material) {
  if (matchesPrintName(object, material, PRINT_MATERIAL_NAME)) return 'front';
  if (matchesPrintName(object, material, BACK_PRINT_MATERIAL_NAME)) return 'back';
  return null;
}

// Non-print part that must not take the garment colour (e.g. a zipper).
function isHardware(material, fabricMaterial) {
  return !!fabricMaterial && !String(material?.name || '').startsWith(fabricMaterial);
}

/**
 * True width/height (model units) of the area the UV rectangle covers on the
 * surface: the average UV Jacobian |dp/du|, |dp/dv| over the UV domain.
 * Unlike the bounding box this is correct for curved panels (e.g. the cap
 * front wraps around the crown). Weighting by UV area keeps near-degenerate
 * UV triangles (common in non-indexed exports) from skewing the result.
 */
function getTrueSurfaceSize(geometry, uvBounds) {
  const position = geometry?.attributes?.position;
  const uv = geometry?.attributes?.uv;
  if (!position || !uv || !uvBounds) return null;

  const index = geometry.index;
  const triCount = index ? index.count / 3 : position.count / 3;
  const vert = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);

  const p0 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const dpdu = new THREE.Vector3();
  const dpdv = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  let sumU = 0;
  let sumV = 0;
  let sumWeight = 0;

  for (let t = 0; t < triCount; t += 1) {
    const i0 = vert(t, 0);
    const i1 = vert(t, 1);
    const i2 = vert(t, 2);

    p0.fromBufferAttribute(position, i0);
    e1.fromBufferAttribute(position, i1).sub(p0);
    e2.fromBufferAttribute(position, i2).sub(p0);

    const du1 = uv.getX(i1) - uv.getX(i0);
    const dv1 = uv.getY(i1) - uv.getY(i0);
    const du2 = uv.getX(i2) - uv.getX(i0);
    const dv2 = uv.getY(i2) - uv.getY(i0);
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;

    dpdu.copy(e1).multiplyScalar(dv2).sub(tmp.copy(e2).multiplyScalar(dv1)).divideScalar(det);
    dpdv.copy(e2).multiplyScalar(du1).sub(tmp.copy(e1).multiplyScalar(du2)).divideScalar(det);

    const weight = Math.abs(det) / 2; // UV-space triangle area
    sumU += dpdu.length() * weight;
    sumV += dpdv.length() * weight;
    sumWeight += weight;
  }

  if (!sumWeight || !sumV) return null;

  const width = (sumU / sumWeight) * (uvBounds.maxU - uvBounds.minU);
  const height = (sumV / sumWeight) * (uvBounds.maxV - uvBounds.minV);

  return height > 1e-9 ? { width, height } : null;
}

function getTrueSurfaceAspect(geometry, uvBounds) {
  const size = getTrueSurfaceSize(geometry, uvBounds);
  return size ? size.width / size.height : null;
}

function findPrintPanel(root, name) {
  let hit = null;
  root.traverse((object) => {
    if (hit || !object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (object.name === name || materials.some((m) => m?.name === name)) hit = object;
  });
  return hit;
}

/**
 * Some models split a print area around a feature, e.g. the zip hoodie has
 * FRONT_PRINT_LEFT / FRONT_PRINT_RIGHT on either side of the zipper. Merge
 * such a pair into ONE `baseName` mesh whose UVs lay the panels out side by
 * side at their true widths, with the gap between them left empty. One
 * design then reads continuously across both panels (the part that falls
 * on the zipper is simply not printed), and the rest of the viewer treats
 * it like any single print surface.
 */
function mergeSplitPrintPanels(root, baseName) {
  const a = findPrintPanel(root, `${baseName}_LEFT`);
  const b = findPrintPanel(root, `${baseName}_RIGHT`);
  if (!a || !b || !a.parent) return;

  root.updateMatrixWorld(true);

  const parent = a.parent;
  const toParent = new THREE.Matrix4().copy(parent.matrixWorld).invert();

  const prepare = (mesh) => {
    const geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();

    geometry.applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(toParent, mesh.matrixWorld)
    );

    const uvBounds = computeUvBounds(geometry);
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);

    return {
      geometry,
      uvBounds,
      box,
      size: getTrueSurfaceSize(geometry, uvBounds),
    };
  };

  // Order by position so the first panel is the one on screen-left (-X)
  // when the model faces the camera, whatever the panels are named.
  let [first, second] = [prepare(a), prepare(b)];
  if (first.box.min.x > second.box.min.x) [first, second] = [second, first];

  if (!first.uvBounds || !second.uvBounds || !first.size || !second.size) return;

  const gap = Math.max(0, second.box.min.x - first.box.max.x);
  const total = first.size.width + gap + second.size.width;

  // Normalised UVs per panel, then u moved into that panel's slot.
  const remapUvs = ({ geometry, uvBounds }, slotStart, slotWidth) => {
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    const spanU = uvBounds.maxU - uvBounds.minU || 1;
    const spanV = uvBounds.maxV - uvBounds.minV || 1;

    // Does u grow towards +X (screen-right)? Flip the panel if not.
    let meanU = 0;
    let meanX = 0;
    for (let i = 0; i < uv.count; i += 1) {
      meanU += uv.getX(i);
      meanX += pos.getX(i);
    }
    meanU /= uv.count;
    meanX /= uv.count;
    let cov = 0;
    for (let i = 0; i < uv.count; i += 1) {
      cov += (uv.getX(i) - meanU) * (pos.getX(i) - meanX);
    }

    const out = new Float32Array(uv.count * 2);
    for (let i = 0; i < uv.count; i += 1) {
      let t = (uv.getX(i) - uvBounds.minU) / spanU;
      if (cov < 0) t = 1 - t;
      out[i * 2] = (slotStart + t * slotWidth) / total;
      out[i * 2 + 1] = (uv.getY(i) - uvBounds.minV) / spanV;
    }
    return out;
  };

  const uvA = remapUvs(first, 0, first.size.width);
  const uvB = remapUvs(second, first.size.width + gap, second.size.width);

  const concat = (name, itemSize) => {
    const x = first.geometry.attributes[name];
    const y = second.geometry.attributes[name];
    if (!x || !y) return null;
    const arr = new Float32Array((x.count + y.count) * itemSize);
    arr.set(x.array.slice(0, x.count * itemSize), 0);
    arr.set(y.array.slice(0, y.count * itemSize), x.count * itemSize);
    return new THREE.BufferAttribute(arr, itemSize);
  };

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', concat('position', 3));
  const normals = concat('normal', 3);
  if (normals) merged.setAttribute('normal', normals);
  else merged.computeVertexNormals();

  const uvs = new Float32Array(uvA.length + uvB.length);
  uvs.set(uvA, 0);
  uvs.set(uvB, uvA.length);
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const sourceMaterial = Array.isArray(a.material) ? a.material[0] : a.material;
  const material = sourceMaterial.clone();
  material.name = baseName;

  const mesh = new THREE.Mesh(merged, material);
  mesh.name = baseName;

  parent.add(mesh);
  a.removeFromParent();
  b.removeFromParent();
}

/** How the editor canvas maps onto one print surface (see MODEL_OPTIONS). */
function computePrintMapping(mesh, uvBounds, { printFit, printWidthBoost }) {
  if (!mesh || printFit === 'stretch' || !printFit) {
    return IDENTITY_MAPPING;
  }

  const editorAspect = EDITOR_W / EDITOR_H;

  if (printFit === 'squeeze') {
    const bboxAspect = getPrintSurfaceAspect(mesh.geometry);
    const surfaceAspect =
      Number.isFinite(bboxAspect) && bboxAspect > 1e-6 ? bboxAspect : editorAspect;

    // Example for the hoodie: editor 326/500 = 0.652, FRONT_PRINT ~ 1.05,
    // base correction ~0.62; printWidthBoost widens it (+44%, tuned by eye).
    const k = THREE.MathUtils.clamp(
      (editorAspect / surfaceAspect) * printWidthBoost,
      0.2,
      printWidthBoost
    );

    return { ax: k, bx: (1 - k) / 2, ay: 1, by: 0 };
  }

  if (printFit === 'band') {
    const surfaceAspect = getTrueSurfaceAspect(mesh.geometry, uvBounds);
    if (!surfaceAspect || surfaceAspect <= editorAspect) {
      return IDENTITY_MAPPING;
    }

    // Fraction of the canvas height that has the surface's proportions,
    // centred vertically (default text/image positions land inside it).
    const bandH = editorAspect / surfaceAspect;
    const bandTop = (1 - bandH) / 2;

    return { ax: 1, bx: 0, ay: 1 / bandH, by: -bandTop / bandH };
  }

  return IDENTITY_MAPPING;
}

const isIdentityMapping = (m) =>
  m.ax === 1 && m.bx === 0 && m.ay === 1 && m.by === 0;

function configureBaseMaterial(material) {
  if (!material) return;

  if ('metalness' in material) {
    material.metalness = 0;
  }

  if ('roughness' in material) {
    material.roughness = 0.58;
  }

  material.needsUpdate = true;
}

function getPrintSurfaceAspect(geometry) {
  if (!geometry) {
    return EDITOR_W / EDITOR_H;
  }

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    return EDITOR_W / EDITOR_H;
  }

  const size = new THREE.Vector3();
  box.getSize(size);

  // FRONT_PRINT is a thin surface. Take the two largest dimensions
  // as its visible width/height and ignore the small depth dimension.
  const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)]
    .filter((v) => v > 1e-6)
    .sort((a, b) => b - a);

  if (dims.length < 2) {
    return EDITOR_W / EDITOR_H;
  }

  return dims[0] / dims[1];
}

function configurePrintMaterial(material) {
  if (!material) return;

  configureBaseMaterial(material);

  // Important:
  // FRONT_PRINT must respect the depth buffer.
  // Otherwise it can be visible through the hoodie from the side/back.
  material.depthTest = true;
  material.depthWrite = true;

  // The print should only render from the real front face.
  material.side = THREE.FrontSide;

  material.transparent = false;
  material.opacity = 1;

  // Helps when FRONT_PRINT sits extremely close to the garment surface.
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -2;

  if ('vertexColors' in material) {
    material.vertexColors = false;
  }

  if (material.emissive) {
    material.emissive.set('#000000');
  }

  material.emissiveMap = null;
  material.aoMap = null;
  material.lightMap = null;

  material.needsUpdate = true;
}

/* =========================================================
   PRINT SURFACE (one per FRONT_PRINT / BACK_PRINT mesh)
========================================================= */

/**
 * Builds the live texture for one print surface. When the model's printFit
 * isn't 'stretch', the design canvas is first re-laid onto a corrected canvas
 * according to `mapping`, so the texture matches what the editor overlay shows.
 * Also publishes the mapping on the mesh for PrintAreaProjector.
 */
function usePrintSurface({
  mesh,
  uvBounds,
  mapping,
  designCanvas,
  designRev,
  color,
}) {
  const needsCorrection =
    !!mesh && !!designCanvas && !isIdentityMapping(mapping);

  const correctedCanvas = useMemo(() => {
    if (!needsCorrection) return null;

    // A band (ay > 1) only uses part of the canvas height, so the corrected
    // canvas can be shorter without losing any resolution.
    const c = document.createElement('canvas');
    c.width = designCanvas.width;
    c.height = Math.max(1, Math.round(designCanvas.height / Math.max(1, mapping.ay)));
    return c;
  }, [needsCorrection, designCanvas, mapping]);

  // PrintAreaProjector uses these to place the editor overlay exactly where
  // the texture lands, so the draggable hit-areas sit on top of the artwork.
  useLayoutEffect(() => {
    if (!mesh) return;
    mesh.userData.printMapping = mapping;
    mesh.userData.printUvBounds = uvBounds;
  }, [mesh, mapping, uvBounds]);

  // Keep the corrected canvas LIVE as images/text move or change.
  useLayoutEffect(() => {
    if (!correctedCanvas || !designCanvas) return;

    const ctx = correctedCanvas.getContext('2d');
    if (!ctx) return;

    const w = correctedCanvas.width;
    const h = correctedCanvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // designCanvas already contains the garment colour. Fill any area the
    // mapping leaves uncovered with the same colour so it stays invisible.
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);

    // texture = a · canvas + b  →  draw the canvas at b, sized a.
    ctx.drawImage(
      designCanvas,
      mapping.bx * w,
      mapping.by * h,
      mapping.ax * w,
      mapping.ay * h
    );
  }, [correctedCanvas, designCanvas, mapping, designRev, color]);

  // One reusable texture per canvas/model UV configuration.
  const texture = useMemo(() => {
    if (!mesh || !designCanvas) return null;

    const tex = new THREE.CanvasTexture(correctedCanvas || designCanvas);
    applyPrintTextureProps(tex, uvBounds);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, [mesh, designCanvas, correctedCanvas, uvBounds]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  // designCanvas is the same DOM canvas object;
  // designRev tells us that its PIXELS changed.
  useEffect(() => {
    if (texture) {
      texture.needsUpdate = true;
    }
  }, [texture, designRev]);

  return texture;
}

/* =========================================================
   GARMENT MESH
========================================================= */

function GarmentMesh({
  color,
  designCanvas,
  designRev,
  backDesignCanvas,
  backDesignRev,
  printMeshRef,
  backPrintMeshRef,
  modelUrl,
  productType,
}) {
  const { scene } = useGLTF(modelUrl);

  const options = MODEL_OPTIONS[productType] ?? {};
  const { rotationY = 0, fabricMaterial } = options;

  const {
    model,
    printMesh,
    printUvBounds,
    backPrintMesh,
    backPrintUvBounds,
    modelCenter,
    normalizationScale,
  } = useMemo(() => {
    // Clone the loaded GLB so colour/texture changes never mutate
    // the cached original scene returned by useGLTF.
    const root = scene.clone(true);

    // Split print areas (e.g. either side of a zipper) become one surface.
    mergeSplitPrintPanels(root, PRINT_MATERIAL_NAME);
    mergeSplitPrintPanels(root, BACK_PRINT_MATERIAL_NAME);

    const found = {
      front: { mesh: null, uvBounds: null },
      back: { mesh: null, uvBounds: null },
    };

    root.traverse((object) => {
      if (!object.isMesh || !object.material) return;

      // Clone materials too, because cloned meshes otherwise still share
      // material instances with the cached GLB scene.
      object.material = Array.isArray(object.material)
        ? object.material.map((m) => m.clone())
        : object.material.clone();

      object.castShadow = false;
      object.receiveShadow = false;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        // Remove baked colour/image maps from the imported GLB.
        // Print surfaces get the live design canvases below.
        material.map = null;

        const side = printSideOf(object, material);

        if (side) {
          found[side].mesh = object;
          found[side].uvBounds =
            computeUvBounds(object.geometry) ||
            found[side].uvBounds;

          object.renderOrder = 1;
          configurePrintMaterial(material);
        } else {
          object.renderOrder = 0;
          configureBaseMaterial(material);
        }

        material.needsUpdate = true;
      });
    });

    // Get the REAL visual centre and model size.
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    box.getCenter(center);
    box.getSize(size);

    const maxDimension = Math.max(
      size.x,
      size.y,
      size.z,
      1e-6
    );

    return {
      model: root,
      printMesh: found.front.mesh,
      printUvBounds: found.front.uvBounds,
      backPrintMesh: found.back.mesh,
      backPrintUvBounds: found.back.uvBounds,
      modelCenter: center,
      normalizationScale: TARGET_MODEL_SIZE / maxDimension,
    };
  }, [scene]);

  // Make the real print meshes available to the screen-space projector.
  useLayoutEffect(() => {
    if (printMeshRef) printMeshRef.current = printMesh || null;
    if (backPrintMeshRef) backPrintMeshRef.current = backPrintMesh || null;

    return () => {
      if (printMeshRef) printMeshRef.current = null;
      if (backPrintMeshRef) backPrintMeshRef.current = null;
    };
  }, [printMesh, printMeshRef, backPrintMesh, backPrintMeshRef]);

  useEffect(() => {
    if (!printMesh) {
      console.warn(
        '[ShirtViewer3D] FRONT_PRINT was not found in:',
        modelUrl
      );
    }
  }, [printMesh, modelUrl]);

  const { printFit, printWidthBoost } = options;

  const frontMapping = useMemo(
    () => computePrintMapping(printMesh, printUvBounds, { printFit, printWidthBoost }),
    [printMesh, printUvBounds, printFit, printWidthBoost]
  );

  const backMapping = useMemo(
    () => computePrintMapping(backPrintMesh, backPrintUvBounds, { printFit, printWidthBoost }),
    [backPrintMesh, backPrintUvBounds, printFit, printWidthBoost]
  );

  const frontTexture = usePrintSurface({
    mesh: printMesh,
    uvBounds: printUvBounds,
    mapping: frontMapping,
    designCanvas,
    designRev,
    color,
  });

  const backTexture = usePrintSurface({
    mesh: backPrintMesh,
    uvBounds: backPrintUvBounds,
    mapping: backMapping,
    designCanvas: backDesignCanvas,
    designRev: backDesignRev,
    color,
  });

  // Apply current garment colour and current print textures.
  useLayoutEffect(() => {
    model.traverse((object) => {
      if (
        !object.isMesh ||
        !object.material
      ) {
        return;
      }

      const materials =
        Array.isArray(object.material)
          ? object.material
          : [object.material];

      materials.forEach(
        (material) => {
          const side = printSideOf(object, material);

          if (side) {
            const texture =
              side === 'back' ? backTexture : frontTexture;

            material.map =
              texture || null;

            // White base preserves uploaded image/text colours exactly.
            // If there is no texture, blend print panel with garment.
            material.color?.set(
              texture
                ? '#ffffff'
                : color
            );

            object.renderOrder = 1;
            configurePrintMaterial(
              material
            );

            return;
          }

          // Base garment colour; hardware (zipper) keeps its own.
          material.map = null;
          material.color?.set(
            isHardware(material, fabricMaterial)
              ? HARDWARE_COLOR
              : color
          );

          object.renderOrder = 0;
          configureBaseMaterial(
            material
          );
        }
      );
    });
  }, [
    model,
    color,
    fabricMaterial,
    frontTexture,
    backTexture,
  ]);

  // Outer group rotates around the already-centred model, so turning it
  // never moves it off-centre.
  return (
    <group rotation={[0, rotationY, 0]}>
      <group
        scale={normalizationScale}
        position={[
          -modelCenter.x *
            normalizationScale,
          -modelCenter.y *
            normalizationScale,
          -modelCenter.z *
            normalizationScale,
        ]}
      >
        <primitive object={model} />
      </group>
    </group>
  );
}

/* =========================================================
   CAMERA / FRONT-BACK CONTROLS
========================================================= */

function SmoothViewControls({
  view,
  resetKey,
  interactive,
}) {
  const controlsRef = useRef(null);

  const targetTheta =
    useRef(null);

  const targetPhi =
    useRef(null);

  const isAnimating =
    useRef(false);

  const gl = useThree(
    (state) => state.gl
  );

  const offset = useMemo(
    () => new THREE.Vector3(),
    []
  );

  const spherical = useMemo(
    () => new THREE.Spherical(),
    []
  );

  const MIN_DISTANCE = 1.25;
  const MAX_DISTANCE = 5;

  /* Front / Back button */
  useEffect(() => {
    const controls =
      controlsRef.current;

    if (!controls) return;

    const camera =
      controls.object;

    const target =
      controls.target;

    offset
      .copy(camera.position)
      .sub(target);

    spherical.setFromVector3(
      offset
    );

    const currentTheta =
      spherical.theta;

    const requestedTheta =
      view === 'back'
        ? Math.PI
        : 0;

    const twoPi =
      Math.PI * 2;

    let delta =
      (requestedTheta -
        currentTheta +
        Math.PI) %
      twoPi;

    if (delta < 0) {
      delta += twoPi;
    }

    delta -= Math.PI;

    targetTheta.current =
      currentTheta + delta;

    // Center vertically.
    targetPhi.current =
      Math.PI / 2;

    isAnimating.current =
      true;
  }, [
    view,
    resetKey,
    offset,
    spherical,
  ]);

  /* Wheel zoom that also works through the editor overlay */
  useEffect(() => {
    const handleWheel = (e) => {
      const controls =
        controlsRef.current;

      const dom =
        gl?.domElement;

      if (!controls || !dom) {
        return;
      }

      const rect =
        dom.getBoundingClientRect();

      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!inside) return;

      e.preventDefault();

      const camera =
        controls.object;

      const target =
        controls.target;

      offset
        .copy(camera.position)
        .sub(target);

      spherical.setFromVector3(
        offset
      );

      const zoomFactor =
        Math.exp(
          e.deltaY * 0.0012
        );

      spherical.radius =
        THREE.MathUtils.clamp(
          spherical.radius *
            zoomFactor,
          MIN_DISTANCE,
          MAX_DISTANCE
        );

      offset.setFromSpherical(
        spherical
      );

      camera.position
        .copy(target)
        .add(offset);

      camera.lookAt(target);
      controls.update();
    };

    window.addEventListener(
      'wheel',
      handleWheel,
      {
        passive: false,
      }
    );

    return () => {
      window.removeEventListener(
        'wheel',
        handleWheel
      );
    };
  }, [
    gl,
    offset,
    spherical,
  ]);

  /* Smooth camera return */
  useFrame((_, deltaTime) => {
    const controls =
      controlsRef.current;

    if (
      !controls ||
      !isAnimating.current ||
      targetTheta.current ===
        null ||
      targetPhi.current ===
        null
    ) {
      return;
    }

    const camera =
      controls.object;

    const target =
      controls.target;

    offset
      .copy(camera.position)
      .sub(target);

    spherical.setFromVector3(
      offset
    );

    spherical.theta =
      THREE.MathUtils.damp(
        spherical.theta,
        targetTheta.current,
        4.5,
        Math.min(
          deltaTime,
          0.05
        )
      );

    spherical.phi =
      THREE.MathUtils.damp(
        spherical.phi,
        targetPhi.current,
        4.5,
        Math.min(
          deltaTime,
          0.05
        )
      );

    offset.setFromSpherical(
      spherical
    );

    camera.position
      .copy(target)
      .add(offset);

    camera.lookAt(target);
    controls.update();

    const thetaDone =
      Math.abs(
        targetTheta.current -
          spherical.theta
      ) < 0.001;

    const phiDone =
      Math.abs(
        targetPhi.current -
          spherical.phi
      ) < 0.001;

    if (
      thetaDone &&
      phiDone
    ) {
      targetTheta.current =
        null;

      targetPhi.current =
        null;

      isAnimating.current =
        false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault

      target={[0, 0, 0]}

      enablePan={false}

      // We use our own wheel handler.
      enableZoom={false}

      enableRotate={interactive}

      minDistance={
        MIN_DISTANCE
      }

      maxDistance={
        MAX_DISTANCE
      }

      minPolarAngle={
        Math.PI / 4
      }

      maxPolarAngle={
        Math.PI / 1.8
      }

      onStart={() => {
        isAnimating.current =
          false;

        targetTheta.current =
          null;

        targetPhi.current =
          null;
      }}
    />
  );
}

/* =========================================================
   FRONT_PRINT -> SCREEN RECT
   Used by DesignPage to position the Konva editor over
   the real 3D print surface.
========================================================= */

function PrintAreaProjector({
  meshRef,
  onRect,
}) {
  const camera = useThree(
    (state) => state.camera
  );

  const size = useThree(
    (state) => state.size
  );

  const last =
    useRef(null);

  const localData =
    useRef(null);

  const scratch = useMemo(
    () => ({
      vertex:
        new THREE.Vector3(),

      center:
        new THREE.Vector3(),

      normal:
        new THREE.Vector3(),

      toCamera:
        new THREE.Vector3(),

      normalMatrix:
        new THREE.Matrix3(),
    }),
    []
  );

  useFrame(() => {
    const mesh =
      meshRef.current;

    if (
      !mesh ||
      !onRect
    ) {
      return;
    }

    const position =
      mesh.geometry
        ?.attributes
        ?.position;

    if (!position) return;

    // Compute local centre and average normal once per mesh
    // (the viewer can switch models without remounting).
    if (localData.current?.mesh !== mesh) {
      const center =
        new THREE.Vector3();

      const normal =
        new THREE.Vector3();

      const temp =
        new THREE.Vector3();

      const normals =
        mesh.geometry
          ?.attributes
          ?.normal;

      for (
        let i = 0;
        i < position.count;
        i += 1
      ) {
        center.add(
          temp.fromBufferAttribute(
            position,
            i
          )
        );

        if (normals) {
          normal.add(
            temp.fromBufferAttribute(
              normals,
              i
            )
          );
        }
      }

      center.multiplyScalar(
        1 / position.count
      );

      if (
        normal.lengthSq() === 0
      ) {
        normal.set(0, 0, 1);
      }

      normal.normalize();

      localData.current = {
        mesh,
        center,
        normal,
      };
    }

    mesh.updateWorldMatrix(
      true,
      false
    );

    const worldCenter =
      scratch.center
        .copy(
          localData.current
            .center
        )
        .applyMatrix4(
          mesh.matrixWorld
        );

    const worldNormal =
      scratch.normal
        .copy(
          localData.current
            .normal
        )
        .applyMatrix3(
          scratch.normalMatrix
            .getNormalMatrix(
              mesh.matrixWorld
            )
        )
        .normalize();

    const toCamera =
      scratch.toCamera
        .copy(camera.position)
        .sub(worldCenter)
        .normalize();

    // Correctly hides the editor when viewing the garment from back.
    const visible =
      worldNormal.dot(
        toCamera
      ) > 0.15;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Least-squares fit of screen position against texture position
    // (screenX ≈ ax + bx·texU, screenY ≈ ay + by·texV). On curved surfaces
    // like the cap this tracks where the artwork really lands far better
    // than the screen bounding box does.
    const uv =
      mesh.geometry.attributes.uv;

    const uvBounds =
      mesh.userData.printUvBounds;

    const spanU = uvBounds
      ? uvBounds.maxU - uvBounds.minU
      : 0;

    const spanV = uvBounds
      ? uvBounds.maxV - uvBounds.minV
      : 0;

    const canFit =
      !!uv && spanU > 1e-6 && spanV > 1e-6;

    let sumU = 0;
    let sumUU = 0;
    let sumX = 0;
    let sumUX = 0;
    let sumV = 0;
    let sumVV = 0;
    let sumY = 0;
    let sumVY = 0;

    for (
      let i = 0;
      i < position.count;
      i += 1
    ) {
      scratch.vertex
        .fromBufferAttribute(
          position,
          i
        )
        .applyMatrix4(
          mesh.matrixWorld
        )
        .project(camera);

      const x =
        (scratch.vertex.x *
          0.5 +
          0.5) *
        size.width;

      const y =
        (-scratch.vertex.y *
          0.5 +
          0.5) *
        size.height;

      minX = Math.min(
        minX,
        x
      );

      minY = Math.min(
        minY,
        y
      );

      maxX = Math.max(
        maxX,
        x
      );

      maxY = Math.max(
        maxY,
        y
      );

      if (canFit) {
        const u =
          (uv.getX(i) - uvBounds.minU) / spanU;

        const v =
          (uv.getY(i) - uvBounds.minV) / spanV;

        sumU += u;
        sumUU += u * u;
        sumX += x;
        sumUX += u * x;
        sumV += v;
        sumVV += v * v;
        sumY += y;
        sumVY += v * y;
      }
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(maxY)
    ) {
      return;
    }

    // Texture-space span [0..1] on screen: fitted when possible,
    // otherwise the screen bounding box.
    let spanLeft = minX;
    let spanWidth = maxX - minX;
    let spanTop = minY;
    let spanHeight = maxY - minY;

    if (canFit) {
      const n = position.count;
      const denomU = n * sumUU - sumU * sumU;
      const denomV = n * sumVV - sumV * sumV;

      const bx = denomU
        ? (n * sumUX - sumU * sumX) / denomU
        : 0;

      const by = denomV
        ? (n * sumVY - sumV * sumY) / denomV
        : 0;

      // Only trust a fit that keeps the artwork upright and unmirrored.
      if (bx > 1 && by > 1) {
        spanLeft = (sumX - bx * sumU) / n;
        spanWidth = bx;
        spanTop = (sumY - by * sumV) / n;
        spanHeight = by;
      }
    }

    // The overlay represents the whole editor canvas. The texture shows
    // it via texture = a · canvas + b (see computePrintMapping), so the
    // canvas starts at b and spans a surface-widths/heights on screen.
    // For a 'band' this makes the overlay taller than the panel, with the
    // printable band sitting exactly on it.
    const mapping =
      mesh.userData.printMapping ?? IDENTITY_MAPPING;

    const rect = {
      left: spanLeft + spanWidth * mapping.bx,
      top: spanTop + spanHeight * mapping.by,
      width: spanWidth * mapping.ax,
      height: spanHeight * mapping.ay,
      visible,
    };

    const prev =
      last.current;

    const changed =
      !prev ||
      prev.visible !==
        rect.visible ||
      Math.abs(
        prev.left -
          rect.left
      ) > 0.5 ||
      Math.abs(
        prev.top -
          rect.top
      ) > 0.5 ||
      Math.abs(
        prev.width -
          rect.width
      ) > 0.5 ||
      Math.abs(
        prev.height -
          rect.height
      ) > 0.5;

    if (changed) {
      last.current = rect;
      onRect(rect);
    }
  });

  return null;
}

/* =========================================================
   ERROR BOUNDARY
========================================================= */

class GLErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      failed: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      failed: true,
    };
  }

  render() {
    if (
      this.state.failed
    ) {
      return this.props
        .fallback;
    }

    return this.props
      .children;
  }
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ShirtViewer3D({
  color = '#ffffff',
  designCanvas,
  designRev = 0,
  view = 'front',
  viewResetKey = 0,
  interactive = true,
  onPrintAreaChange,
  productType = 'male',
  modelUrl,
  // Optional back-side design, rendered onto BACK_PRINT when the model has it.
  backDesignCanvas = null,
  backDesignRev = 0,
  // Which print surface the editor overlay (onPrintAreaChange) follows.
  printSide = 'front',
}) {
  const printMeshRef =
    useRef(null);

  const backPrintMeshRef =
    useRef(null);

  const resolvedModelUrl =
    modelUrl ||
    MODEL_URLS[productType] ||
    MODEL_URLS.male;

  return (
    <GLErrorBoundary
      fallback={
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems:
              'center',
            color:
              '#8A98A6',
            fontSize: 13,
          }}
        >
          3D ხედი მიუწვდომელია
        </div>
      }
    >
      <Canvas
        camera={{
          position: [
            0,
            0,
            2.25,
          ],
          fov: 38,
          near: 0.01,
          far: 100,
        }}

        dpr={[1, 2]}

        gl={{
          preserveDrawingBuffer:
            true,
          antialias: true,
          alpha: true,
        }}

        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <ambientLight
          intensity={0.9}
        />

        <hemisphereLight
          args={[
            '#ffffff',
            '#c7b8a8',
            0.6,
          ]}
        />

        <directionalLight
          position={[
            4,
            6,
            5,
          ]}
          intensity={1.5}
        />

        <directionalLight
          position={[
            -4,
            2,
            -4,
          ]}
          intensity={0.45}
        />

        <Suspense fallback={null}>
          <GarmentMesh
            color={color}
            designCanvas={
              designCanvas
            }
            designRev={
              designRev
            }
            printMeshRef={
              printMeshRef
            }
            backDesignCanvas={
              backDesignCanvas
            }
            backDesignRev={
              backDesignRev
            }
            backPrintMeshRef={
              backPrintMeshRef
            }
            modelUrl={
              resolvedModelUrl
            }
            productType={
              productType
            }
          />
        </Suspense>

        {onPrintAreaChange && (
          <PrintAreaProjector
            meshRef={
              printSide === 'back'
                ? backPrintMeshRef
                : printMeshRef
            }
            onRect={
              onPrintAreaChange
            }
          />
        )}

        <SmoothViewControls
          view={view}
          resetKey={
            viewResetKey
          }
          interactive={
            interactive
          }
        />
      </Canvas>
    </GLErrorBoundary>
  );
}
