import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer } from 'react-konva';
import useImage from 'use-image';
import useCartStore from '../store/cartStore';
import api from '../lib/api';
import ShirtViewer3D from '../components/ShirtViewer3D';
import {
  createShirtCanvas,
  renderShirtCanvas,
  EDITOR_W,
  EDITOR_H,
} from '../lib/shirtTexture';
import s from './DesignPage.module.css';

/* ── Product images ──────────────────────────────────────── */
import tshirtFront from '../assets/Product_img/basic_tshirt_front.png';
import hoodieFront from '../assets/Product_img/hoodies_sweatshirt_front.png';
import hoodieBack from '../assets/Product_img/hoodies_sweatshirt_back.png';
import hat from '../assets/Product_img/hat.png';
import bagFront from '../assets/Product_img/bag_front.png';
import bagBack from '../assets/Product_img/bag_back.png';
import pillow from '../assets/Product_img/pillow.png';

/* ── Men's t-shirt images ────────────────────────────────── */
import manWhite from '../assets/mans_tshirts/man_white.png';
import manBlack from '../assets/mans_tshirts/man_black.png';
import manGrey from '../assets/mans_tshirts/man_grey.png';
import manRed from '../assets/mans_tshirts/man_red.png';
import manBlue from '../assets/mans_tshirts/man_blue.png';
import manGreen from '../assets/mans_tshirts/man_green.png';

/* ── Women's t-shirt images ──────────────────────────────── */
import womanWhite from '../assets/product_women/white.png';
import womanBlack from '../assets/product_women/black.png';
import womanGrey from '../assets/product_women/grey.png';
import womanRed from '../assets/product_women/red.png';
import womanBlue from '../assets/product_women/blue.png';
import womanGreen from '../assets/product_women/green.png';

const TSHIRT_IMAGES = {
  man: {
    white: manWhite,
    black: manBlack,
    grey: manGrey,
    red: manRed,
    blue: manBlue,
    green: manGreen,
  },
  woman: {
    white: womanWhite,
    black: womanBlack,
    grey: womanGrey,
    red: womanRed,
    blue: womanBlue,
    green: womanGreen,
  },
};

const COLOR_FILTERS = {
  white: 'none',
  black: 'brightness(0.15) contrast(1.2)',
  grey: 'saturate(0) brightness(0.6)',
  red: 'sepia(1) saturate(8) hue-rotate(310deg) brightness(0.85)',
  blue: 'sepia(1) saturate(6) hue-rotate(185deg) brightness(0.8)',
  green: 'sepia(1) saturate(6) hue-rotate(80deg) brightness(0.75)',
};

const GEO = {
  addText: '+ ტექსტი',
  upload: '+ ფოტო',
  delete: 'წაშლა',
  order: 'შეკვეთა',
  addCart: 'კალათაში',
  size: 'ზომა',
  qty: 'რაოდენობა',
  price: 'ფასი',
  front: 'წინა',
  back: 'უკანა',
};

const CATEGORIES = [
  {
    id: 'tshirt',
    label: 'მაისური',
    // Product.category this tab orders from (null = not sold yet).
    category: 'TSHIRT',
    front: tshirtFront,
    back: null,
    hasBack: false,
  },
  {
    id: 'hoodie',
    label: 'ჰუდი',
    category: 'HOODIE',
    front: hoodieFront,
    back: hoodieBack,
    hasBack: true,
  },
  {
    id: 'hat',
    label: 'ქუდი',
    category: null,
    front: hat,
    back: null,
    hasBack: false,
  },
  {
    id: 'bag',
    label: 'ჩანთა',
    category: 'BAG',
    front: bagFront,
    back: bagBack,
    hasBack: true,
  },
  {
    id: 'pillow',
    label: 'ბალიშის პირი',
    category: null,
    front: pillow,
    back: null,
    hasBack: false,
  },
];

// Tabs rendered with the 3D viewer → ShirtViewer3D productType.
// Tabs not listed here use the flat product image instead.
const MODEL_TYPE_BY_TAB = {
  tshirt: 'male',
  hoodie: 'hoodie',
  hat: 'cap',
};

// Hoodie styles. All belong to the hoodie product; each has its own 3D model
// and its own design.
const HOODIE_STYLES = [
  { id: 'pocket', label: 'ჯიბით', model: 'hoodie' },
  { id: 'zip', label: 'ელვით', model: 'hoodie_zip' },
];

// 3D models with a BACK_PRINT surface. On these the Front/Back buttons also
// switch which side's design is being edited.
const BACK_PRINT_MODELS = new Set(['cap', 'hoodie', 'hoodie_zip']);

const EMPTY_SIDE = { images: [], textObjects: [] };
const EMPTY_DESIGN = { front: EMPTY_SIDE, back: EMPTY_SIDE };
const EMPTY_HISTORY = { entries: [], step: -1 };

const SHIRT_COLORS = [
  { key: 'white', hex: '#ffffff' },
  { key: 'black', hex: '#1a1a1a' },
  { key: 'grey', hex: '#888888' },
  { key: 'red', hex: '#cc2222' },
  { key: 'blue', hex: '#2244cc' },
  { key: 'green', hex: '#228833' },
];

const TEXT_COLORS = [
  '#ffffff',
  '#1a1a1a',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
];

const FONT_FAMILIES = [
  'Arial',
  'Myriad Pro',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
  'Impact',
];

const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

const CANVAS_WIDTH = EDITOR_W;
const CANVAS_HEIGHT = EDITOR_H;

const UPLOAD_BOX = 140;

const TEXT_DEFAULT_X = 60;
const TEXT_DEFAULT_Y = 220;

const NUDGE_STEP = 5;
const NUDGE_STEP_SHIFT = 20;

function fitBox(naturalW, naturalH, box = UPLOAD_BOX) {
  const aspect = (naturalW || 1) / (naturalH || 1);

  return aspect >= 1
    ? {
        width: box,
        height: box / aspect,
      }
    : {
        width: box * aspect,
        height: box,
      };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const clampPos = (v) => clamp(Math.round(v), -2000, 2000);

const clampScale = (v) =>
  Math.round(clamp(v, 0.1, 5) * 1000) / 1000;

const clampRot = (v) =>
  clamp(Math.round(v), -180, 180);

const clampFont = (v) =>
  clamp(Math.round(v), 8, 300);

const clampOpacity = (v) =>
  Math.round(clamp(v, 0.1, 1) * 100) / 100;

const nudgeAmount = (e) =>
  e.shiftKey ? NUDGE_STEP_SHIFT : NUDGE_STEP;

/* ── Transformer helper ──────────────────────────────────── */

function SelectionTransformer({ nodeRef, isSelected, is3DMode }) {
  const transformerRef = useRef(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    const node = nodeRef.current;

    if (!transformer) return;

    if (isSelected && !is3DMode && node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [isSelected, is3DMode, nodeRef]);

  if (!isSelected || is3DMode) return null;

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled
      keepRatio
      flipEnabled={false}
      enabledAnchors={[
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]}
      rotateAnchorOffset={28}
      borderStroke="#c9a96e"
      borderStrokeWidth={1.5}
      anchorStroke="#16283F"
      anchorStrokeWidth={1.5}
      anchorFill="#ffffff"
      anchorSize={10}
      anchorCornerRadius={10}
      boundBoxFunc={(oldBox, newBox) => {
        if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
          return oldBox;
        }
        return newBox;
      }}
    />
  );
}

/* ── Uploaded image ─────────────────────────────────────── */

const DesignImage = ({
  imgData,
  isSelected,
  onSelect,
  onChange,
  is3DMode = false,
  is3DProduct = false,
}) => {
  const [image] = useImage(imgData.src);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (!image) return;
    if (imgData.width && imgData.height) return;

    onChange?.(
      fitBox(image.naturalWidth, image.naturalHeight),
      { silent: true }
    );
  }, [image]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxW = imgData.width ?? UPLOAD_BOX;
  const boxH = imgData.height ?? UPLOAD_BOX;
  const scale = imgData.scale ?? 1;

  const finishTransform = () => {
    const n = nodeRef.current;
    if (!n) return;

    const scaleX = n.scaleX();
    const nextScale = clampScale(scale * scaleX);

    n.scaleX(1);
    n.scaleY(1);

    onChange?.({
      x: clampPos(n.x()),
      y: clampPos(n.y()),
      scale: nextScale,
      rotation: clampRot(n.rotation()),
    });
  };

  /*
    On the 3D T-shirt the real artwork is already rendered into
    FRONT_PRINT. Konva only supplies the invisible interactive hit-area.
  */
  if (is3DProduct) {
    return (
      <>
        <Rect
          ref={nodeRef}
          x={imgData.x}
          y={imgData.y}
          width={boxW * scale}
          height={boxH * scale}
          rotation={imgData.rotation ?? 0}
          fill="rgba(0,0,0,0.001)"
          stroke={isSelected && !is3DMode ? '#c9a96e' : undefined}
          strokeWidth={isSelected && !is3DMode ? 1 : 0}
          draggable={!is3DMode}
          onClick={onSelect}
          onTap={onSelect}
          onDragMove={(e) =>
            onChange?.(
              {
                x: e.target.x(),
                y: e.target.y(),
              },
              { silent: true }
            )
          }
          onDragEnd={(e) =>
            onChange?.({
              x: clampPos(e.target.x()),
              y: clampPos(e.target.y()),
            })
          }
          onTransformEnd={finishTransform}
        />

        <SelectionTransformer
          nodeRef={nodeRef}
          isSelected={isSelected}
          is3DMode={is3DMode}
        />
      </>
    );
  }

  return (
    <>
      <KonvaImage
        ref={nodeRef}
        image={image}
        x={imgData.x}
        y={imgData.y}
        width={boxW}
        height={boxH}
        scaleX={scale}
        scaleY={scale}
        rotation={imgData.rotation ?? 0}
        opacity={imgData.opacity ?? 1}
        onClick={onSelect}
        onTap={onSelect}
        draggable={!is3DMode}
        onDragEnd={(e) =>
          onChange?.({
            x: clampPos(e.target.x()),
            y: clampPos(e.target.y()),
          })
        }
        onTransformEnd={finishTransform}
      />

      <SelectionTransformer
        nodeRef={nodeRef}
        isSelected={isSelected}
        is3DMode={is3DMode}
      />
    </>
  );
};

function getKonvaFontStyle(node) {
  const parts = [];

  if (node.fontStyle === 'italic') {
    parts.push('italic');
  }

  if (node.fontWeight === 'bold') {
    parts.push('bold');
  }

  return parts.length
    ? parts.join(' ')
    : 'normal';
}

/* ── Text node ──────────────────────────────────────────── */

function TextItem({
  node,
  isSelected,
  onSelect,
  onChange,
  is3DMode = false,
  is3DProduct = false,
}) {
  const measureRef = useRef(null);
  const nodeRef = useRef(null);

  const [box, setBox] = useState({
    w: 0,
    h: 0,
  });

  useEffect(() => {
    if (!measureRef.current) return;

    setBox({
      w: measureRef.current.width(),
      h: measureRef.current.height(),
    });
  }, [
    node.text,
    node.fontSize,
    node.fontFamily,
    node.fontStyle,
    node.fontWeight,
    node.lineHeight,
    node.letterSpacing,
    node.textScaleX,
    node.textScaleY,
  ]);

  const finishTransform = () => {
    const n = nodeRef.current;
    if (!n) return;

    const baseScaleX = is3DProduct
      ? 1
      : node.textScaleX ?? 1;

    const baseScaleY = is3DProduct
      ? 1
      : node.textScaleY ?? 1;

    const transformScaleX =
      n.scaleX() / baseScaleX;

    const nextFontSize =
      clampFont(
        (node.fontSize ?? 28) *
          transformScaleX
      );

    n.scaleX(baseScaleX);
    n.scaleY(baseScaleY);

    onChange?.({
      x: clampPos(n.x()),
      y: clampPos(n.y()),
      fontSize: nextFontSize,
      rotation: clampRot(n.rotation()),
    });
  };

  /*
    3D T-shirt: visible text comes from the FRONT_PRINT texture.
    The transparent Rect is only for selection / drag / resize / rotate.
  */
  if (is3DProduct) {
    return (
      <>
        <Text
          ref={measureRef}
          text={node.text}
          x={node.x}
          y={node.y}
          fontSize={node.fontSize}
          fontFamily={node.fontFamily}
          fontStyle={getKonvaFontStyle(node)}
          lineHeight={node.lineHeight ?? 1}
          letterSpacing={node.letterSpacing ?? 0}
          rotation={node.rotation ?? 0}
          opacity={0}
          listening={false}
        />

        {box.w > 0 && box.h > 0 && (
          <>
            <Rect
              ref={nodeRef}
              x={node.x}
              y={node.y}
              width={
                box.w *
                (node.textScaleX ?? 1)
              }
              height={
                box.h *
                (node.textScaleY ?? 1)
              }
              rotation={node.rotation ?? 0}
              fill="rgba(0,0,0,0.001)"
              stroke={isSelected && !is3DMode ? '#c9a96e' : undefined}
              strokeWidth={isSelected && !is3DMode ? 1 : 0}
              draggable={!is3DMode}
              onClick={onSelect}
              onTap={onSelect}
              onDragMove={(e) =>
                onChange?.(
                  {
                    x: e.target.x(),
                    y: e.target.y(),
                  },
                  { silent: true }
                )
              }
              onDragEnd={(e) =>
                onChange?.({
                  x: clampPos(e.target.x()),
                  y: clampPos(e.target.y()),
                })
              }
              onTransformEnd={finishTransform}
            />

            <SelectionTransformer
              nodeRef={nodeRef}
              isSelected={isSelected}
              is3DMode={is3DMode}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Text
        ref={(el) => {
          measureRef.current = el;
          nodeRef.current = el;
        }}
        text={node.text}
        x={node.x}
        y={node.y}
        fontSize={node.fontSize}
        fill={node.fill}
        fontFamily={node.fontFamily}
        fontStyle={getKonvaFontStyle(node)}
        lineHeight={node.lineHeight ?? 1}
        letterSpacing={node.letterSpacing ?? 0}
        scaleX={node.textScaleX ?? 1}
        scaleY={node.textScaleY ?? 1}
        rotation={node.rotation ?? 0}
        opacity={node.opacity ?? 1}
        draggable={!is3DMode}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) =>
          onChange?.({
            x: clampPos(e.target.x()),
            y: clampPos(e.target.y()),
          })
        }
        onTransformEnd={finishTransform}
      />

      <SelectionTransformer
        nodeRef={nodeRef}
        isSelected={isSelected}
        is3DMode={is3DMode}
      />
    </>
  );
}

/* ── Collapsible section ───────────────────────────────── */

function Section({
  title,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] =
    useState(defaultOpen);

  return (
    <div className={s.section}>
      <button
        className={s.sectionHeader}
        onClick={() =>
          setOpen((o) => !o)
        }
      >
        <span>{title}</span>

        <svg
          className={`${s.chevron} ${
            open
              ? s.chevronOpen
              : ''
          }`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={s.sectionBody}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */

export default function DesignPage() {
  const { productId } =
    useParams();

  const navigate =
    useNavigate();

  const addItem =
    useCartStore(
      (st) => st.addItem
    );

  // All active products. The URL's :productId picks one of them, and the
  // active tab must always match that product's category.
  const [products, setProducts] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const product =
    products?.find(
      (p) => p.id === productId
    ) ?? null;

  // Last product id used per category, so switching tabs back and forth
  // returns to the product the customer came from.
  const [productByCategory, setProductByCategory] =
    useState({});

  const [syncedProductId, setSyncedProductId] =
    useState(null);

  const [activeTab, setActiveTab] =
    useState('tshirt');

  const [side, setSide] =
    useState('front');

  const [hoodieStyle, setHoodieStyle] =
    useState(HOODIE_STYLES[0].id);

  // 3D model shown for the active tab (the hoodie tab depends on its style).
  const modelType =
    activeTab === 'hoodie'
      ? (HOODIE_STYLES.find(
          (st) => st.id === hoodieStyle
        ) ?? HOODIE_STYLES[0]).model
      : MODEL_TYPE_BY_TAB[activeTab];

  // Designs and undo history are kept per product AND per model variant.
  const designKey =
    activeTab === 'hoodie'
      ? `hoodie:${hoodieStyle}`
      : activeTab;

  const [view3d, setView3d] =
    useState('front');

  // Increments on every Front/Back button click.
  // This lets the same button reset the 3D view even when `view3d`
  // already has that value (for example after manual OrbitControls rotation).
  const [view3dResetKey, setView3dResetKey] =
    useState(0);

    const [is3DMode, setIs3DMode] =
  useState(false);

  const [flipPhase, setFlipPhase] =
    useState('');

  const [
    shirtColor,
    setShirtColor,
  ] = useState('white');

  const [gender, setGender] =
    useState('man');

  const [size, setSize] =
    useState('M');

  const [quantity, setQuantity] =
    useState(1);

  const [cartAdded, setCartAdded] =
    useState(false);

  const [textInput, setTextInput] =
    useState('');

  const [textColor, setTextColor] =
    useState('#1a1a1a');

  const [fontSize, setFontSize] =
    useState(28);

  // Every product (tab) has its own design, and each of its print sides has
  // its own images/texts — uploads, moves and resizes on one product or side
  // never touch another. `images` / `textObjects` below are always the
  // product + side currently being edited, so the editor code works on one
  // surface at a time without knowing about products or sides.
  const [designsByTab, setDesignsByTab] =
    useState({});

  const designs =
    designsByTab[designKey] ?? EMPTY_DESIGN;

  // Replaces the active product/variant's { front, back } design.
  const setDesigns = useCallback(
    (update) =>
      setDesignsByTab((all) => {
        const current =
          all[designKey] ?? EMPTY_DESIGN;
        return {
          ...all,
          [designKey]:
            typeof update === 'function'
              ? update(current)
              : update,
        };
      }),
    [designKey]
  );

  const supportsBackPrint =
    BACK_PRINT_MODELS.has(modelType);

  const editSide =
    supportsBackPrint &&
    view3d === 'back'
      ? 'back'
      : 'front';

  const images =
    designs[editSide].images;

  const textObjects =
    designs[editSide].textObjects;

  const setSideField = useCallback(
    (field, update) =>
      setDesigns((d) => ({
        ...d,
        [editSide]: {
          ...d[editSide],
          [field]:
            typeof update === 'function'
              ? update(d[editSide][field])
              : update,
        },
      })),
    [setDesigns, editSide]
  );

  const setImages = useCallback(
    (update) => setSideField('images', update),
    [setSideField]
  );

  const setTextObjects = useCallback(
    (update) => setSideField('textObjects', update),
    [setSideField]
  );

  const [
    selectedId,
    setSelectedId,
  ] = useState(null);

  const stageRef =
    useRef(null);

  const viewerRef =
    useRef(null);

  const shirtHex =
    SHIRT_COLORS.find(
      (c) =>
        c.key === shirtColor
    )?.hex ?? '#ffffff';

  const [designCanvas] =
    useState(
      createShirtCanvas
    );

  const [
    designRev,
    setDesignRev,
  ] = useState(0);

  const [backDesignCanvas] =
    useState(
      createShirtCanvas
    );

  const [
    backDesignRev,
    setBackDesignRev,
  ] = useState(0);

  const [
    printRect,
    setPrintRect,
  ] = useState(null);

  const handlePrintArea =
    useCallback(
      (rect) =>
        setPrintRect(rect),
      []
    );

  // Render each side's design into its own texture canvas.
  const frontDesign = designs.front;
  const backDesign = designs.back;

  useEffect(() => {
    let cancelled = false;

    renderShirtCanvas(
      designCanvas,
      {
        shirtColor: shirtHex,
        images: frontDesign.images.filter(
          (item) => item.visible !== false
        ),
        textObjects: frontDesign.textObjects.filter(
          (item) => item.visible !== false
        ),
      }
    ).then(() => {
      if (!cancelled) {
        setDesignRev(
          (r) => r + 1
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    frontDesign,
    shirtHex,
    designCanvas,
  ]);

  useEffect(() => {
    let cancelled = false;

    renderShirtCanvas(
      backDesignCanvas,
      {
        shirtColor: shirtHex,
        images: backDesign.images.filter(
          (item) => item.visible !== false
        ),
        textObjects: backDesign.textObjects.filter(
          (item) => item.visible !== false
        ),
      }
    ).then(() => {
      if (!cancelled) {
        setBackDesignRev(
          (r) => r + 1
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    backDesign,
    shirtHex,
    backDesignCanvas,
  ]);

  /* Undo / redo */

  // One history per product, so undo on one product never changes another.
  const [
    historyByTab,
    setHistoryByTab,
  ] = useState({});

  const {
    entries: history,
    step: historyStep,
  } = historyByTab[designKey] ?? EMPTY_HISTORY;

  const setTabHistory = (
    entries,
    step
  ) =>
    setHistoryByTab((all) => ({
      ...all,
      [designKey]: {
        entries,
        step,
      },
    }));

  // Snapshots hold BOTH sides, so undo/redo never mixes up front and back.
  const saveHistory = (
    newImages,
    newTexts
  ) => {
    const base =
      history.slice(
        0,
        historyStep + 1
      );

    base.push({
      designs: {
        ...designs,
        [editSide]: {
          images: newImages,
          textObjects: newTexts,
        },
      },
    });

    setTabHistory(
      base,
      base.length - 1
    );
  };

  const undo = () => {
    if (
      historyStep <= 0
    )
      return;

    const step =
      history[
        historyStep - 1
      ];

    setDesigns(step.designs);

    setTabHistory(
      history,
      historyStep - 1
    );
  };

  const redo = () => {
    if (
      historyStep >=
      history.length - 1
    )
      return;

    const step =
      history[
        historyStep + 1
      ];

    setDesigns(step.designs);

    setTabHistory(
      history,
      historyStep + 1
    );
  };

  const deleteSelectedObject = () => {
    if (!selectedId) return;

    const imageExists =
      images.some(
        (item) =>
          item.id === selectedId
      );

    if (imageExists) {
      const nextImages =
        images.filter(
          (item) =>
            item.id !== selectedId
        );

      setImages(nextImages);

      saveHistory(
        nextImages,
        textObjects
      );

      setSelectedId(null);
      return;
    }

    const textExists =
      textObjects.some(
        (item) =>
          item.id === selectedId
      );

    if (textExists) {
      const nextTexts =
        textObjects.filter(
          (item) =>
            item.id !== selectedId
        );

      setTextObjects(nextTexts);

      saveHistory(
        images,
        nextTexts
      );

      setSelectedId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (
      e
    ) => {
      if (
        (e.ctrlKey ||
          e.metaKey) &&
        e.key === 'z'
      ) {
        e.preventDefault();
        undo();
      }

      if (
        (e.ctrlKey ||
          e.metaKey) &&
        e.key === 'y'
      ) {
        e.preventDefault();
        redo();
      }

      const target =
        e.target;

      const isTyping =
        target instanceof
          HTMLInputElement ||
        target instanceof
          HTMLTextAreaElement ||
        target instanceof
          HTMLSelectElement ||
        target?.isContentEditable;

      if (
        !isTyping &&
        selectedId &&
        (e.key === 'Delete' ||
          e.key === 'Backspace')
      ) {
        e.preventDefault();
        deleteSelectedObject();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
  }, [
    historyStep,
    history,
    selectedId,
    images,
    textObjects,
    // Shortcuts must always act on the product/side on screen.
    designKey,
    editSide,
  ]);

  useEffect(() => {
    const imagesToPreload = [
      manWhite,
      manBlack,
      manGrey,
      manRed,
      manBlue,
      manGreen,
      womanWhite,
      womanBlack,
      womanGrey,
      womanRed,
      womanBlue,
      womanGreen,
    ];

    imagesToPreload.forEach(
      (src) => {
        const img =
          new Image();

        img.src = src;
      }
    );
  }, []);

  const activeCat =
    CATEGORIES.find(
      (c) =>
        c.id === activeTab
    ) ?? CATEGORIES[0];

  const is3D =
    activeTab in MODEL_TYPE_BY_TAB;

  const currentSrc =
    activeTab === 'tshirt'
      ? TSHIRT_IMAGES[
          gender
        ][shirtColor] ??
        TSHIRT_IMAGES[
          gender
        ].white
      : side === 'back' &&
        activeCat.back
      ? activeCat.back
      : activeCat.front;

  const activeFilter =
    is3D
      ? 'none'
      : COLOR_FILTERS[
          shirtColor
        ] ?? 'none';

  // On back-printable products these also switch the side being edited,
  // so drop a selection that belongs to the other side.
  const showFront = () => {
    if (supportsBackPrint && editSide !== 'front') setSelectedId(null);
    setView3d('front');
    setView3dResetKey((n) => n + 1);
  };

  const showBack = () => {
    if (supportsBackPrint && editSide !== 'back') setSelectedId(null);
    setView3d('back');
    setView3dResetKey((n) => n + 1);
  };

  const toggle3DMode = () => {
  if (is3DMode) {
    // 3D Mode ითიშება -> დაბრუნდეს საწყის front პოზიციაზე
    setView3d('front');
    setView3dResetKey((n) => n + 1);
    setIs3DMode(false);
  } else {
    // 3D Mode ჩაირთოს
    setIs3DMode(true);
  }
};

  function resetForTab(id) {
    setActiveTab(id);
    setSide('front');
    setView3d('front');
    setFlipPhase('');
    setSelectedId(null);
    setPrintRect(null);
  }

  // Hoodie style = different 3D model with its own design; reset the view
  // like a tab switch.
  function switchHoodieStyle(id) {
    if (id === hoodieStyle) return;
    setHoodieStyle(id);
    setView3d('front');
    setView3dResetKey((n) => n + 1);
    setSelectedId(null);
    setPrintRect(null);
  }

  function switchTab(id) {
    resetForTab(id);

    // Point the URL at a real product of this tab's category so the
    // name, price and sizes shown (and sent to the cart) match the tab.
    const category =
      CATEGORIES.find(
        (c) => c.id === id
      )?.category;

    if (
      !category ||
      product?.category === category
    )
      return;

    const target =
      products?.find(
        (p) =>
          p.id ===
          productByCategory[category]
      ) ??
      products?.find(
        (p) => p.category === category
      );

    if (target) {
      navigate(
        `/design/${target.id}`,
        { replace: true }
      );
    }
  }

  function goToSide(
    target
  ) {
    if (
      target === side ||
      !activeCat.hasBack
    )
      return;

    setFlipPhase('out');

    const t1 =
      setTimeout(() => {
        setSide(target);
        setFlipPhase('in');

        const t2 =
          setTimeout(
            () =>
              setFlipPhase(
                ''
              ),
            200
          );

        return () =>
          clearTimeout(t2);
      }, 180);

    return () =>
      clearTimeout(t1);
  }

  useEffect(() => {
    api
      .get('/api/products')
      .then((r) => {
        setProducts(
          Array.isArray(r.data)
            ? r.data
            : []
        );
        setLoading(false);
      })
      .catch(() =>
        setLoading(false)
      );
  }, []);

  // When the URL's product changes (first load, a tab switch, or arriving
  // from the shop / navbar), remember it for its category and open the
  // matching tab. Done during render so the wrong tab never paints.
  if (
    product &&
    product.id !== syncedProductId
  ) {
    setSyncedProductId(product.id);
    setProductByCategory((prev) => ({
      ...prev,
      [product.category]: product.id,
    }));

    const tab = CATEGORIES.find(
      (c) =>
        c.category ===
        product.category
    );

    if (
      tab &&
      tab.id !== activeTab
    ) {
      resetForTab(tab.id);
    }
  }

  // Product the current tab would order, or null if this tab has no
  // product in the database (hat, pillow case, or none added yet).
  const orderProduct =
    product &&
    activeCat.category === product.category
      ? product
      : null;

  const sizeOptions =
    orderProduct?.sizes?.length
      ? orderProduct.sizes
      : SIZES;

  // Fall back to the middle size when the chosen one isn't offered.
  const selectedSize =
    sizeOptions.includes(size)
      ? size
      : sizeOptions[
          Math.floor(
            (sizeOptions.length - 1) / 2
          )
        ];

  function handleAddText() {
    if (
      !textInput.trim()
    )
      return;

    const id =
      Date.now();

    const created = {
      id,
      text: textInput.trim(),
      x: TEXT_DEFAULT_X,
      y: TEXT_DEFAULT_Y,
      fontSize,
      rotation: 0,
      fill: textColor,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      lineHeight: 1,
      letterSpacing: 0,
      textScaleX: 1,
      textScaleY: 1,
      visible: true,
      layerName: textInput.trim(),
    };

    created.initialDefaults =
      {
        x: created.x,
        y: created.y,
        fontSize:
          created.fontSize,
        rotation: 0,
        fill: created.fill,
      };

    const newTexts = [
      ...textObjects,
      created,
    ];

    setTextObjects(
      newTexts
    );

    saveHistory(
      images,
      newTexts
    );

    setSelectedId(id);
    setTextInput('');
  }

  function handleFontSizeChange(
    val
  ) {
    setFontSize(val);

    if (selectedId) {
      setTextObjects(
        (prev) =>
          prev.map((t) =>
            t.id === selectedId
              ? {
                  ...t,
                  fontSize: val,
                }
              : t
          )
      );
    }
  }

  function handleTextColorChange(
    color
  ) {
    setTextColor(color);

    if (selectedId) {
      setTextObjects(
        (prev) =>
          prev.map((t) =>
            t.id === selectedId
              ? {
                  ...t,
                  fill: color,
                }
              : t
          )
      );
    }
  }

  const deleteImageById = (id) => {
    const nextImages =
      images.filter(
        (item) =>
          item.id !== id
      );

    setImages(nextImages);

    saveHistory(
      nextImages,
      textObjects
    );

    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handlePhotoUpload = (
    e
  ) => {
    const file =
      e.target.files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = (
      ev
    ) => {
      const src =
        ev.target.result;

      const probe =
        new Image();

      probe.onload = () => {
        const {
          width,
          height,
        } = fitBox(
          probe.naturalWidth,
          probe.naturalHeight
        );

        const x =
          clampPos(
            (CANVAS_WIDTH -
              width) /
              2
          );

        const y =
          clampPos(
            (CANVAS_HEIGHT -
              height) /
              2
          );

        setImages(
          (prev) => {
            const next = [
              ...prev,
              {
                id: String(
                  Date.now()
                ),
                name: file.name,
                layerName: file.name,
                visible: true,
                src,
                x,
                y,
                width,
                height,
                scale: 1,
                rotation: 0,
                opacity: 1,
                initialDefaults:
                  {
                    x,
                    y,
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                  },
              },
            ];

            saveHistory(
              next,
              textObjects
            );

            return next;
          }
        );
      };

      probe.src = src;
    };

    reader.readAsDataURL(
      file
    );

    e.target.value = '';
  };


  const selectedText =
    textObjects.find(
      (item) =>
        item.id === selectedId
    ) || null;

  const patchSelectedText = (
    patch
  ) => {
    if (!selectedText) return;

    setTextObjects((prev) =>
      prev.map((item) =>
        item.id === selectedText.id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  };

  const layerItems = [
    ...textObjects.map((item) => ({
      ...item,
      objectType: 'text',
    })),
    ...images.map((item) => ({
      ...item,
      objectType: 'image',
    })),
  ].sort(
    (a, b) =>
      Number(a.id) - Number(b.id)
  );

  const renameLayer = (
    objectType,
    id,
    layerName
  ) => {
    if (objectType === 'text') {
      setTextObjects((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                layerName,
              }
            : item
        )
      );
    } else {
      setImages((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                layerName,
              }
            : item
        )
      );
    }
  };

  const toggleLayerVisibility = (
    objectType,
    id
  ) => {
    if (objectType === 'text') {
      setTextObjects((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                visible:
                  item.visible ===
                  false,
              }
            : item
        )
      );
    } else {
      setImages((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                visible:
                  item.visible ===
                  false,
              }
            : item
        )
      );
    }

    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const deleteLayer = (
    objectType,
    id
  ) => {
    if (objectType === 'text') {
      const nextTexts =
        textObjects.filter(
          (item) =>
            item.id !== id
        );

      setTextObjects(nextTexts);

      saveHistory(
        images,
        nextTexts
      );
    } else {
      const nextImages =
        images.filter(
          (item) =>
            item.id !== id
        );

      setImages(nextImages);

      saveHistory(
        nextImages,
        textObjects
      );
    }

    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  async function handleAddToCart() {
    if (!orderProduct) return;

    const hasBackDesign =
      supportsBackPrint &&
      (backDesign.images.length > 0 ||
        backDesign.textObjects.length > 0);

    const canvasJson =
      JSON.stringify({
        // Top-level images/texts are the FRONT design (unchanged format).
        images: frontDesign.images,
        texts:
          frontDesign.textObjects,
        ...(hasBackDesign
          ? {
              back: {
                images: backDesign.images,
                texts: backDesign.textObjects,
              },
            }
          : {}),
        garment: activeTab,
        ...(activeTab === 'tshirt' ? { gender } : {}),
        ...(activeTab === 'hoodie' ? { hoodieStyle, model: modelType } : {}),
        garmentColor: shirtHex,
        printArea: {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
        },
      });

    let previewUrl = '';
    let backPreviewUrl = '';

    // Frames the current 3D view into a 400x500 JPEG.
    const snapshot3D = (glCanvas) => {
      const off =
        document.createElement(
          'canvas'
        );

      off.width = 400;
      off.height = 500;

      const ctx =
        off.getContext(
          '2d'
        );

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 500);

      const fit = Math.min(
        400 / glCanvas.width,
        500 / glCanvas.height
      );
      const w = glCanvas.width * fit;
      const h = glCanvas.height * fit;

      ctx.drawImage(
        glCanvas,
        (400 - w) / 2,
        (500 - h) / 2,
        w,
        h
      );

      return off.toDataURL(
        'image/jpeg',
        0.8
      );
    };

    try {
      setSelectedId(null);

      await new Promise(
        (r) =>
          setTimeout(r, 30)
      );

      const glCanvas = is3D
        ? viewerRef.current?.querySelector('canvas')
        : null;

      if (glCanvas) {
        // On 3D garments the artwork lives on the print textures and
        // the Konva nodes are invisible hit-areas, so snapshot the 3D view.
        // Turn the camera first (the damped return takes ~1s).
        if (hasBackDesign) {
          showBack();
          await new Promise(
            (r) =>
              setTimeout(r, 1000)
          );
          backPreviewUrl =
            snapshot3D(glCanvas);
        }

        showFront();
        await new Promise(
          (r) =>
            setTimeout(r, 1000)
        );

        previewUrl =
          snapshot3D(glCanvas);
      } else if (
        stageRef.current
      ) {
        const off =
          document.createElement(
            'canvas'
          );

        off.width = 400;
        off.height = 500;

        const ctx =
          off.getContext(
            '2d'
          );

        const img =
          new Image();

        img.src =
          currentSrc;

        await new Promise(
          (r) => {
            img.onload = r;
            img.onerror =
              r;
          }
        );

        ctx.drawImage(
          img,
          0,
          0,
          400,
          500
        );

        const stageImg =
          new Image();

        stageImg.src =
          stageRef.current.toDataURL(
            {
              pixelRatio: 1,
            }
          );

        await new Promise(
          (r) => {
            stageImg.onload =
              r;
            stageImg.onerror =
              r;
          }
        );

        ctx.drawImage(
          stageImg,
          0,
          0
        );

        previewUrl =
          off.toDataURL(
            'image/jpeg',
            0.8
          );
      }
    } catch {
      previewUrl = '';
    }

    addItem({
      productId:
        orderProduct.id,

      productName:
        orderProduct.name,

      basePrice:
        orderProduct.basePrice,

      size: selectedSize,
      quantity,
      shirtColor,
      canvasJson,
      previewUrl,
      ...(backPreviewUrl
        ? { backPreviewUrl }
        : {}),
    });

    setCartAdded(true);

    setTimeout(
      () =>
        setCartAdded(
          false
        ),
      2200
    );

    navigate('/cart');
  }

  if (loading)
    return (
      <div
        className={
          s.loadingPage
        }
      >
        იტვირთება...
      </div>
    );

  if (!product)
    return (
      <div
        className={
          s.loadingPage
        }
      >
        პროდუქტი ვერ
        მოიძებნა
      </div>
    );

  const price = orderProduct
    ? (
        orderProduct.basePrice *
        quantity
      ).toFixed(2)
    : null;

  const flipCls =
    flipPhase === 'out'
      ? s.flipOut
      : flipPhase ===
        'in'
      ? s.flipIn
      : '';

  return (
    <div className={s.page}>
      {/* LEFT SIDEBAR */}

      <aside
        className={
          s.leftSidebar
        }
      >
        <div
          className={
            s.productTabs
          }
        >
          {CATEGORIES.map(
            (c) => (
              <button
                key={c.id}
                className={`${s.productTab} ${
                  activeTab ===
                  c.id
                    ? s.productTabActive
                    : ''
                }`}
                onClick={() =>
                  switchTab(
                    c.id
                  )
                }
              >
                {c.label}
              </button>
            )
          )}
        </div>

        {activeTab ===
          'tshirt' && (
          <div
            style={{
              padding:
                '10px 16px 0',
            }}
          >
            <div
              className={
                s.genderToggle
              }
            >
              <button
                className={`${s.genderBtn} ${
                  gender ===
                  'man'
                    ? s.genderBtnActive
                    : ''
                }`}
                onClick={() =>
                  setGender(
                    'man'
                  )
                }
              >
                კაცი
              </button>

              <button
                className={`${s.genderBtn} ${
                  gender ===
                  'woman'
                    ? s.genderBtnActive
                    : ''
                }`}
                onClick={() =>
                  setGender(
                    'woman'
                  )
                }
              >
                ქალი
              </button>
            </div>
          </div>
        )}

        {activeTab ===
          'hoodie' && (
          <div
            style={{
              padding:
                '10px 16px 0',
            }}
          >
            <div
              className={
                s.genderToggle
              }
              role="group"
              aria-label="ჰუდის სტილი"
            >
              {HOODIE_STYLES.map(
                (st) => (
                  <button
                    key={st.id}
                    type="button"
                    aria-pressed={
                      hoodieStyle ===
                      st.id
                    }
                    className={`${s.genderBtn} ${
                      hoodieStyle ===
                      st.id
                        ? s.genderBtnActive
                        : ''
                    }`}
                    onClick={() =>
                      switchHoodieStyle(
                        st.id
                      )
                    }
                  >
                    {st.label}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <Section title="ფერი">
          <div
            className={
              s.colorGrid
            }
          >
            {SHIRT_COLORS.map(
              ({
                key,
                hex,
              }) => (
                <button
                  key={key}
                  className={`${s.colorDot} ${
                    shirtColor ===
                    key
                      ? s.colorDotActive
                      : ''
                  }`}
                  style={{
                    background:
                      hex,
                    border:
                      hex ===
                      '#ffffff'
                        ? '1.5px solid #ddd'
                        : 'none',
                  }}
                  onClick={() =>
                    setShirtColor(
                      key
                    )
                  }
                />
              )
            )}
          </div>
        </Section>

        <Section
          title="სურათი"
          defaultOpen={
            false
          }
        >
          <label
            className={
              s.uploadBtn
            }
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line
                x1="12"
                y1="3"
                x2="12"
                y2="15"
              />
            </svg>

            {GEO.upload}

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{
                display:
                  'none',
              }}
              onChange={
                handlePhotoUpload
              }
            />
          </label>

          {images.length > 0 && (
            <div
              style={{
                display:
                  'flex',
                flexDirection:
                  'column',
                gap: '8px',
                marginTop:
                  '10px',
              }}
            >
              {images.map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={
                      item.id
                    }
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: '9px',
                      padding:
                        '8px 9px',
                      border:
                        selectedId ===
                        item.id
                          ? '1.5px solid #c9a96e'
                          : '1px solid #e5e7eb',
                      borderRadius:
                        '9px',
                      background:
                        '#ffffff',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          item.id
                        )
                      }
                      style={{
                        width:
                          '42px',
                        height:
                          '42px',
                        padding: 0,
                        flexShrink:
                          0,
                        border:
                          '1px solid #e5e7eb',
                        borderRadius:
                          '7px',
                        background:
                          '#f7f7f7',
                        overflow:
                          'hidden',
                        cursor:
                          'pointer',
                      }}
                      title="სურათის არჩევა"
                    >
                      <img
                        src={
                          item.src
                        }
                        alt=""
                        style={{
                          width:
                            '100%',
                          height:
                            '100%',
                          objectFit:
                            'cover',
                          display:
                            'block',
                        }}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          item.id
                        )
                      }
                      style={{
                        minWidth:
                          0,
                        flex: 1,
                        padding: 0,
                        border:
                          'none',
                        background:
                          'transparent',
                        textAlign:
                          'left',
                        cursor:
                          'pointer',
                      }}
                    >
                      <span
                        style={{
                          display:
                            'block',
                          overflow:
                            'hidden',
                          textOverflow:
                            'ellipsis',
                          whiteSpace:
                            'nowrap',
                          color:
                            '#16283F',
                          fontSize:
                            '12px',
                          fontWeight:
                            600,
                        }}
                      >
                        {item.name ||
                          item.layerName ||
                          `სურათი ${index + 1}`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteImageById(
                          item.id
                        )
                      }
                      aria-label="სურათის წაშლა"
                      title="წაშლა"
                      style={{
                        width:
                          '32px',
                        height:
                          '32px',
                        flexShrink:
                          0,
                        display:
                          'grid',
                        placeItems:
                          'center',
                        border:
                          'none',
                        borderRadius:
                          '6px',
                        background:
                          'transparent',
                        color:
                          '#ef4444',
                        cursor:
                          'pointer',
                        fontSize:
                          '20px',
                        lineHeight:
                          1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </Section>

        <Section title="ტექსტი">
          <textarea
            className={
              s.textArea
            }
            rows={2}
            placeholder="ტექსტი..."
            value={
              textInput
            }
            onChange={(e) =>
              setTextInput(
                e.target.value
              )
            }
          />

          <div
            className={
              s.fontSizeRow
            }
          >
            <span
              className={
                s.sliderLabel
              }
            >
              ზომა: {fontSize}
              px
            </span>

            <input
              type="range"
              min="12"
              max="72"
              value={
                fontSize
              }
              className={
                s.slider
              }
              onChange={(
                e
              ) =>
                handleFontSizeChange(
                  +e
                    .target
                    .value
                )
              }
            />
          </div>

          <div
            className={
              s.textColorRow
            }
          >
            {TEXT_COLORS.map(
              (c) => (
                <button
                  key={c}
                  className={`${s.textColorDot} ${
                    textColor ===
                    c
                      ? s.textColorDotActive
                      : ''
                  }`}
                  style={{
                    background:
                      c,
                    border:
                      c ===
                      '#ffffff'
                        ? '1.5px solid #ddd'
                        : 'none',
                  }}
                  onClick={() =>
                    handleTextColorChange(
                      c
                    )
                  }
                />
              )
            )}
          </div>

          {selectedText && (
            <div
              style={{
                marginTop: '14px',
                paddingTop: '14px',
                borderTop: '1px solid #ececec',
              }}
            >
            <div
              style={{
                display: 'grid',
                gap: '10px',
              }}
            >
              <label
                style={{
                  display: 'grid',
                  gap: '5px',
                }}
              >
                <span
                  className={
                    s.sliderLabel
                  }
                >
                  ფონტი
                </span>

                <select
                  value={
                    selectedText.fontFamily ??
                    'Arial'
                  }
                  onChange={(e) =>
                    patchSelectedText({
                      fontFamily:
                        e.target.value,
                    })
                  }
                  style={{
                    width: '100%',
                    height: '38px',
                    border:
                      '1px solid #e1e1e1',
                    borderRadius:
                      '8px',
                    padding:
                      '0 10px',
                    background:
                      '#ffffff',
                    color:
                      '#16283F',
                    fontSize:
                      '13px',
                  }}
                >
                  {FONT_FAMILIES.map(
                    (family) => (
                      <option
                        key={
                          family
                        }
                        value={
                          family
                        }
                      >
                        {family}
                      </option>
                    )
                  )}
                </select>
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '1fr 1fr',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    patchSelectedText({
                      fontWeight:
                        selectedText.fontWeight ===
                        'bold'
                          ? 'normal'
                          : 'bold',
                    })
                  }
                  style={{
                    height: '38px',
                    borderRadius:
                      '8px',
                    border:
                      selectedText.fontWeight ===
                      'bold'
                        ? '1.5px solid #c9a96e'
                        : '1px solid #e1e1e1',
                    background:
                      selectedText.fontWeight ===
                      'bold'
                        ? '#fffaf0'
                        : '#ffffff',
                    color:
                      '#16283F',
                    cursor:
                      'pointer',
                    fontWeight:
                      800,
                  }}
                >
                  B — Bold
                </button>

                <button
                  type="button"
                  onClick={() =>
                    patchSelectedText({
                      fontStyle:
                        selectedText.fontStyle ===
                        'italic'
                          ? 'normal'
                          : 'italic',
                    })
                  }
                  style={{
                    height: '38px',
                    borderRadius:
                      '8px',
                    border:
                      selectedText.fontStyle ===
                      'italic'
                        ? '1.5px solid #c9a96e'
                        : '1px solid #e1e1e1',
                    background:
                      selectedText.fontStyle ===
                      'italic'
                        ? '#fffaf0'
                        : '#ffffff',
                    color:
                      '#16283F',
                    cursor:
                      'pointer',
                    fontStyle:
                      'italic',
                    fontWeight:
                      700,
                  }}
                >
                  I — Italic
                </button>
              </div>

              <label
                style={{
                  display: 'grid',
                  gap: '5px',
                }}
              >
                <span
                  className={
                    s.sliderLabel
                  }
                >
                  ზომა:{' '}
                  {Math.round(
                    selectedText.fontSize ??
                      28
                  )}
                  px
                </span>

                <input
                  type="range"
                  min="8"
                  max="300"
                  step="1"
                  className={
                    s.slider
                  }
                  value={Math.round(
                    selectedText.fontSize ??
                      28
                  )}
                  onChange={(e) =>
                    patchSelectedText({
                      fontSize:
                        clampFont(
                          Number(
                            e.target
                              .value
                          )
                        ),
                    })
                  }
                />

                <input
                  type="number"
                  min="8"
                  max="300"
                  step="1"
                  className={
                    s.objInput
                  }
                  value={Math.round(
                    selectedText.fontSize ??
                      28
                  )}
                  onChange={(e) => {
                    const value =
                      toNum(
                        e.target
                          .value
                      );

                    if (
                      value !== null
                    ) {
                      patchSelectedText({
                        fontSize:
                          clampFont(
                            value
                          ),
                      });
                    }
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  patchSelectedText({
                    fontFamily: 'Arial',
                    fontWeight: 'normal',
                    fontStyle: 'normal',
                    fontSize: 28,
                    lineHeight: 1,
                    letterSpacing: 0,
                    textScaleX: 1,
                    textScaleY: 1,
                    fill: '#1a1a1a',
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '8px',
                  border: '1px solid #16283F',
                  background: '#ffffff',
                  color: '#16283F',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                პარამეტრების დარესეტება
              </button>

            </div>
            </div>
          )}

          <button
            className={
              s.addTextBtn
            }
            onClick={
              handleAddText
            }
          >
            {GEO.addText}
          </button>
        </Section>

        <Section title="ლეიერები">
          <div
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: '7px',
            }}
          >
            {layerItems.length ===
            0 ? (
              <div
                className={
                  s.objMsg
                }
              >
                ჯერ ობიექტები
                არ არის
              </div>
            ) : (
              layerItems.map(
                (
                  item,
                  index
                ) => {
                  const isText =
                    item.objectType ===
                    'text';

                  const hidden =
                    item.visible ===
                    false;

                  const active =
                    selectedId ===
                    item.id;

                  const fallbackName =
                    isText
                      ? item.text ||
                        `ტექსტი ${
                          index + 1
                        }`
                      : item.name ||
                        `სურათი ${
                          index + 1
                        }`;

                  return (
                    <div
                      key={`${item.objectType}-${item.id}`}
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: '7px',
                        minHeight:
                          '46px',
                        padding:
                          '6px 7px',
                        borderRadius:
                          '9px',
                        border:
                          active
                            ? '1.5px solid #c9a96e'
                            : '1px solid #e5e7eb',
                        background:
                          active
                            ? '#fffaf0'
                            : '#ffffff',
                        opacity:
                          hidden
                            ? 0.55
                            : 1,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={
                          hidden
                            ? 'ობიექტის გამოჩენა'
                            : 'ობიექტის დამალვა'
                        }
                        title={
                          hidden
                            ? 'გამოჩენა'
                            : 'დამალვა'
                        }
                        onClick={() =>
                          toggleLayerVisibility(
                            item.objectType,
                            item.id
                          )
                        }
                        style={{
                          width:
                            '32px',
                          height:
                            '32px',
                          flexShrink:
                            0,
                          display:
                            'grid',
                          placeItems:
                            'center',
                          border:
                            'none',
                          background:
                            'transparent',
                          cursor:
                            'pointer',
                          fontSize:
                            '17px',
                          color:
                            '#16283F',
                        }}
                      >
                        {hidden
                          ? '◌'
                          : '◉'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          !hidden &&
                          setSelectedId(
                            item.id
                          )
                        }
                        style={{
                          width:
                            '30px',
                          height:
                            '30px',
                          flexShrink:
                            0,
                          border:
                            '1px solid #e5e7eb',
                          borderRadius:
                            '6px',
                          background:
                            '#f7f7f7',
                          overflow:
                            'hidden',
                          padding: 0,
                          cursor:
                            hidden
                              ? 'default'
                              : 'pointer',
                          display:
                            'grid',
                          placeItems:
                            'center',
                          fontWeight:
                            800,
                          color:
                            '#16283F',
                        }}
                      >
                        {isText ? (
                          'T'
                        ) : (
                          <img
                            src={
                              item.src
                            }
                            alt=""
                            style={{
                              width:
                                '100%',
                              height:
                                '100%',
                              objectFit:
                                'cover',
                            }}
                          />
                        )}
                      </button>

                      <input
                        value={
                          item.layerName ??
                          fallbackName
                        }
                        onFocus={() =>
                          !hidden &&
                          setSelectedId(
                            item.id
                          )
                        }
                        onChange={(
                          e
                        ) =>
                          renameLayer(
                            item.objectType,
                            item.id,
                            e.target
                              .value
                          )
                        }
                        aria-label="ლეიერის სახელი"
                        style={{
                          minWidth:
                            0,
                          flex: 1,
                          height:
                            '32px',
                          padding:
                            '0 8px',
                          border:
                            '1px solid transparent',
                          borderRadius:
                            '6px',
                          outline:
                            'none',
                          background:
                            'transparent',
                          color:
                            '#16283F',
                          fontSize:
                            '12px',
                          fontWeight:
                            active
                              ? 700
                              : 500,
                        }}
                      />

                      <button
                        type="button"
                        aria-label="ობიექტის წაშლა"
                        title="წაშლა"
                        onClick={() =>
                          deleteLayer(
                            item.objectType,
                            item.id
                          )
                        }
                        style={{
                          width:
                            '32px',
                          height:
                            '32px',
                          flexShrink:
                            0,
                          display:
                            'grid',
                          placeItems:
                            'center',
                          border:
                            'none',
                          borderRadius:
                            '6px',
                          background:
                            'transparent',
                          color:
                            '#ef4444',
                          cursor:
                            'pointer',
                          fontSize:
                            '18px',
                          lineHeight:
                            1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                }
              )
            )}
          </div>
        </Section>

      </aside>

      {/* CENTER */}

      <main
        className={
          s.centerArea
        }
      >
        <div
          className={
            s.productViewer
          }
        >
          <div
            className={
              flipCls
            }
            style={
              is3D
                ? {
                    position:
                      'relative',

                    width:
                      '100%',

                    flex: 1,

                    minHeight:
                      0,

                    margin:
                      '0 auto',

                    // The editor overlay spans the whole 326x500 canvas and
                    // grows with zoom (much taller than the panel on the cap).
                    // Clip it to the viewer so it can never cover the
                    // Front / Back / 3D Mode buttons below.
                    overflow:
                      'hidden',
                  }
                : {
                    position:
                      'relative',

                    width:
                      '400px',

                    height:
                      '500px',

                    margin:
                      '0 auto',
                  }
            }
          >
            <div
              ref={viewerRef}
              style={
                is3D
                  ? {
                      position:
                        'absolute',

                      inset: 0,

                      borderRadius:
                        '18px',

                      overflow:
                        'hidden',
                    }
                  : {
                      width:
                        '400px',

                      height:
                        '500px',

                      display:
                        'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      flexShrink:
                        0,

                      overflow:
                        'hidden',

                      borderRadius:
                        '18px',
                    }
              }
            >
              {is3D ? (
                <ShirtViewer3D
                  color={
                    shirtHex
                  }
                  designCanvas={
                    designCanvas
                  }
                  designRev={
                    designRev
                  }
                  view={
                    view3d
                  }
                  viewResetKey={
                    view3dResetKey
                  }
                  interactive={
                    is3DMode
                  }
                  onPrintAreaChange={
                    handlePrintArea
                  }
                  productType={
                    modelType
                  }
                  backDesignCanvas={
                    supportsBackPrint
                      ? backDesignCanvas
                      : null
                  }
                  backDesignRev={
                    backDesignRev
                  }
                  printSide={
                    editSide
                  }
                />
              ) : (
                <img
                  src={
                    currentSrc
                  }
                  alt={
                    activeCat.label
                  }
                  draggable={
                    false
                  }
                  style={{
                    width:
                      '400px',

                    height:
                      '500px',

                    objectFit:
                      'contain',

                    objectPosition:
                      'center',

                    display:
                      'block',

                    flexShrink:
                      0,

                    filter:
                      activeFilter,

                    transition:
                      'filter 0.3s ease',
                  }}
                />
              )}
            </div>

            <div
              style={
                is3D
                  ? {
                      position:
                        'absolute',

                      left:
                        printRect
                          ? `${printRect.left}px`
                          : '50%',

                      top:
                        printRect
                          ? `${printRect.top}px`
                          : '0px',

                      width:
                        CANVAS_WIDTH +
                        'px',

                      height:
                        CANVAS_HEIGHT +
                        'px',

                      margin: 0,

                      padding: 0,

                      transformOrigin:
                        'top left',

                      transform:
                        printRect
                          ? `scale(${
                              printRect.width /
                              CANVAS_WIDTH
                            }, ${
                              printRect.height /
                              CANVAS_HEIGHT
                            })`
                          : 'translateX(-50%)',

                      opacity:
                        printRect &&
                        printRect.visible
                          ? 1
                          : 0,

                      // A hidden overlay (print side facing away) must not
                      // swallow clicks meant for the viewer or the buttons.
                      pointerEvents:
                        !is3DMode &&
                        printRect &&
                        printRect.visible
                          ? 'auto'
                          : 'none',

                      transition:
                        'opacity 0.2s ease',
                    }
                  : {
                      position:
                        'absolute',

                      top:
                        '-15px',

                      left:
                        '33px',

                      width:
                        CANVAS_WIDTH +
                        'px',

                      height:
                        CANVAS_HEIGHT +
                        'px',

                      margin: 0,

                      padding: 0,

                      opacity: 1,

                     pointerEvents: is3DMode
                      ? 'none'
                      : 'auto',
                    }
              }
            >
              <Stage
                ref={stageRef}
                width={
                  CANVAS_WIDTH
                }
                height={
                  CANVAS_HEIGHT
                }
                onMouseDown={(
                  e
                ) => {
                  if (
                    e.target ===
                    e.target.getStage()
                  ) {
                    setSelectedId(
                      null
                    );
                  }
                }}
                onTap={(
                  e
                ) => {
                  if (
                    e.target ===
                    e.target.getStage()
                  ) {
                    setSelectedId(
                      null
                    );
                  }
                }}
              >
                <Layer>
                  {images
                    .filter((img) => img.visible !== false)
                    .map((img) => (
                    <DesignImage
                      key={img.id}
                      imgData={img}
                      isSelected={selectedId === img.id}
                      is3DProduct={is3D}
                      is3DMode={is3DMode}
                      onSelect={() => setSelectedId(img.id)}
                      onChange={(newProps, opts) => {
                        setImages((prev) => {
                          const next = prev.map((i) =>
                            i.id === img.id
                              ? { ...i, ...newProps }
                              : i
                          );

                          if (!opts?.silent) {
                            saveHistory(next, textObjects);
                          }

                          return next;
                        });
                      }}
                    />
                  ))}

                  {textObjects
                    .filter((t) => t.visible !== false)
                    .map((t) => (
                    <TextItem
                      key={t.id}
                      node={t}
                      isSelected={selectedId === t.id}
                      is3DProduct={is3D}
                      is3DMode={is3DMode}
                      onSelect={() => setSelectedId(t.id)}
                      onChange={(newProps, opts) => {
                        setTextObjects((prev) => {
                          const next = prev.map((item) =>
                            item.id === t.id
                              ? { ...item, ...newProps }
                              : item
                          );

                          if (!opts?.silent) {
                            saveHistory(images, next);
                          }

                          return next;
                        });
                      }}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
          </div>

        {is3D && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '4px',
            }}
          >
            <button
              type="button"
              onClick={showFront}
              aria-pressed={supportsBackPrint ? editSide === 'front' : undefined}
              style={{
                padding: '8px 24px',
                minWidth: '92px',
                borderRadius: '999px',
                // Filled = the side being edited (back-printable products).
                background: supportsBackPrint && editSide === 'front' ? '#16283F' : '#ffffff',
                color: supportsBackPrint && editSide === 'front' ? '#ffffff' : '#16283F',
                border: '1.5px solid #16283F',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              წინა
            </button>

            <button
              type="button"
              onClick={showBack}
              aria-pressed={supportsBackPrint ? editSide === 'back' : undefined}
              style={{
                padding: '8px 24px',
                minWidth: '92px',
                borderRadius: '999px',
                // Filled = the side being edited (back-printable products).
                background: supportsBackPrint && editSide === 'back' ? '#16283F' : '#ffffff',
                color: supportsBackPrint && editSide === 'back' ? '#ffffff' : '#16283F',
                border: '1.5px solid #16283F',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              უკანა
            </button>
            <button
  onClick={toggle3DMode}
  style={{
    padding: '8px 24px',
    minWidth: '110px',
    borderRadius: '999px',
    background: is3DMode
      ? '#16283F'
      : '#ffffff',
    color: is3DMode
      ? '#ffffff'
      : '#16283F',
    border: '1.5px solid #16283F',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
  }}
>
  3D Mode
            </button>
          </div>
        )}

        </div>
      </main>

      {/* RIGHT SIDEBAR */}

      <aside
        className={
          s.rightSidebar
        }
      >
        <div
          className={
            s.productInfo
          }
        >
          <div
            className={
              s.productName
            }
          >
            {orderProduct
              ? orderProduct.name
              : activeCat.label}
          </div>

          <div
            className={
              s.productCat
            }
          >
            {activeCat.label}
          </div>
        </div>

        <div
          className={
            s.divider
          }
        />

        {/* Sizes come from the product (set in admin); single-size products need no picker. */}
        {orderProduct &&
          sizeOptions.length > 1 && (
          <>
            <div
              className={
                s.controlBlock
              }
            >
              <div
                className={
                  s.controlLabel
                }
              >
                {GEO.size}
              </div>

              <div
                className={
                  s.sizeGrid
                }
              >
                {sizeOptions.map(
                  (sz) => (
                    <button
                      key={
                        sz
                      }
                      className={`${s.sizeBtn} ${
                        selectedSize ===
                        sz
                          ? s.sizeBtnActive
                          : ''
                      }`}
                      onClick={() =>
                        setSize(
                          sz
                        )
                      }
                    >
                      {sz}
                    </button>
                  )
                )}
              </div>
            </div>

            <div
              className={
                s.divider
              }
            />
          </>
        )}

        <div
          className={
            s.controlBlock
          }
        >
          <div
            className={
              s.controlLabel
            }
          >
            {GEO.qty}
          </div>

          <div
            className={
              s.qtyControl
            }
          >
            <button
              className={
                s.qtyBtn
              }
              onClick={() =>
                setQuantity(
                  (q) =>
                    Math.max(
                      1,
                      q - 1
                    )
                )
              }
            >
              −
            </button>

            <span
              className={
                s.qtyVal
              }
            >
              {quantity}
            </span>

            <button
              className={
                s.qtyBtn
              }
              onClick={() =>
                setQuantity(
                  (q) =>
                    q + 1
                )
              }
            >
              +
            </button>
          </div>
        </div>

        <div
          className={
            s.divider
          }
        />

        <div
          className={
            s.priceRow
          }
        >
          <span
            className={
              s.priceLabel
            }
          >
            {GEO.price}
          </span>

          <div>
            <div
              className={
                s.priceValue
              }
            >
              {price !== null
                ? `₾${price}`
                : '—'}
            </div>

            <div
              className={
                s.priceUnit
              }
            >
              {price !== null
                ? `× ${quantity} ცალი`
                : 'ჯერ არ იყიდება'}
            </div>
          </div>
        </div>

        <div
          className={
            s.divider
          }
        />

        <div
          className={
            s.colorPreview
          }
        >
          <span
            className={
              s.controlLabel
            }
          >
            შერჩეული ფერი
          </span>

          <div
            className={
              s.colorPreviewDot
            }
            style={{
              background:
                SHIRT_COLORS.find(
                  (c) =>
                    c.key ===
                    shirtColor
                )?.hex ??
                '#fff',

              border:
                shirtColor ===
                'white'
                  ? '2px solid #ddd'
                  : 'none',
            }}
          />
        </div>

        <div
          className={
            s.actions
          }
        >
          <button
            className={
              s.orderBtn
            }
            onClick={
              handleAddToCart
            }
            disabled={
              !orderProduct
            }
          >
            {GEO.order}
          </button>

          <button
            className={`${s.cartBtn} ${
              cartAdded
                ? s.cartBtnAdded
                : ''
            }`}
            onClick={
              handleAddToCart
            }
            disabled={
              cartAdded ||
              !orderProduct
            }
          >
            {cartAdded
              ? '✓ დამატებულია'
              : GEO.addCart}
          </button>
        </div>
      </aside>
    </div>
  );
}
