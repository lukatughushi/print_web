import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer } from 'react-konva';
import useImage from 'use-image';
import useCartStore from '../store/cartStore';
import api from '../lib/api';
import { priceOf } from '../lib/catalog';
import ShirtViewer3D from '../components/ShirtViewer3D';
import {
  createShirtCanvas,
  renderShirtCanvas,
  EDITOR_W,
  EDITOR_H,
  sortByStack,
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
    label: 'კეპი',
    category: 'CAP',
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
  bag: 'tote',
};

// Hoodie styles. All belong to the hoodie product; each has its own 3D model
// and its own design.
const HOODIE_STYLES = [
  { id: 'pocket', label: 'ჯიბით', model: 'hoodie' },
  { id: 'zip', label: 'ელვით', model: 'hoodie_zip' },
];

// 3D models with a BACK_PRINT surface. On these the Front/Back buttons also
// switch which side's design is being edited.
const BACK_PRINT_MODELS = new Set(['cap', 'hoodie', 'hoodie_zip', 'tote']);

const EMPTY_SIDE = { images: [], textObjects: [] };
const EMPTY_DESIGN = { front: EMPTY_SIDE, back: EMPTY_SIDE };
const EMPTY_HISTORY = { entries: [], step: -1 };

const SHIRT_COLORS = [
  { key: 'white', hex: '#ffffff', name: 'თეთრი' },
  { key: 'black', hex: '#1a1a1a', name: 'შავი' },
  { key: 'grey', hex: '#888888', name: 'ნაცრისფერი' },
  { key: 'red', hex: '#cc2222', name: 'წითელი' },
  { key: 'blue', hex: '#2244cc', name: 'ლურჯი' },
  { key: 'green', hex: '#228833', name: 'მწვანე' },
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

// Web fonts shown as cards (loaded in index.html). The classic list above
// stays available under "other fonts".
const WEB_FONTS = [
  { family: 'Bebas Neue', label: 'Bebas Neue' },
  { family: 'Noto Sans Georgian', label: 'Noto Sans' },
  { family: 'Noto Serif Georgian', label: 'Noto Serif' },
  { family: 'Caveat', label: 'Caveat' },
];

const ALL_FONTS = [
  ...WEB_FONTS.map((f) => f.family),
  ...FONT_FAMILIES,
];

const DEFAULT_FONT = 'Noto Sans Georgian';

const fontLabel = (family) =>
  WEB_FONTS.find((f) => f.family === family)?.label ?? family;

const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

/* ── Icons (stroke icons from the constructor design) ───── */

function Icon({ d, size = 18, width = 1.7, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d && <path d={d} />}
      {children}
    </svg>
  );
}

const SHIRT_PATH =
  'M8 3 4 5 2 9l3 2 1-1v11h12V10l1 1 3-2-2-4-4-2c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z';

const ICONS = {
  product: <Icon d={SHIRT_PATH} size={22} width={1.6} />,
  color: (
    <Icon size={22} width={1.6}>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8z" />
      <circle cx="7.5" cy="11" r="1.2" />
      <circle cx="10.5" cy="7" r="1.2" />
      <circle cx="15.5" cy="8" r="1.2" />
    </Icon>
  ),
  text: <Icon d="M5 7V5h14v2M12 5v14M9 19h6" size={22} width={1.6} />,
  image: (
    <Icon size={22} width={1.6}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </Icon>
  ),
  layers: (
    <Icon size={16} width={1.8}>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 13 9 5 9-5" />
    </Icon>
  ),
  eye: (
    <Icon size={16} width={1.8}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  eyeOff: (
    <Icon size={16} width={1.8}>
      <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Icon>
  ),
  up: <Icon d="m6 15 6-6 6 6" size={14} width={2} />,
  down: <Icon d="m6 9 6 6 6-6" size={14} width={2} />,
  trash: <Icon d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" size={16} width={1.8} />,
  undo: <Icon d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" width={1.8} />,
  redo: <Icon d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" width={1.8} />,
  rotate: <Icon d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" size={15} width={1.8} />,
  upload: <Icon d="M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" size={20} width={1.8} />,
  cart: (
    <Icon size={17} width={1.8}>
      <path d="M3 4h2l2.4 11h11l2-8H6.2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </Icon>
  ),
  front: <Icon d={SHIRT_PATH} size={16} />,
  back: (
    <Icon
      d="M8 3 4 5 2 9l3 2 1-1v11h12V10l1 1 3-2-2-4-4-2c-1 .8-2.4 1.2-4 1.2S9 3.8 8 3z"
      size={16}
    />
  ),
  cube: <Icon d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zM4 7.5 12 12l8-4.5M12 12v9" size={16} />,
};

const TOOLS = [
  { id: 'product', label: 'პროდუქტი' },
  { id: 'color', label: 'ფერი' },
  { id: 'text', label: 'ტექსტი' },
  { id: 'image', label: 'სურათი' },
];

const formatPrice = (value) => `${Number(value).toFixed(2)} ₾`;

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

// Object ids: texts keep numeric ids, images string ids (as saved before).
const newId = () => Date.now();

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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

  // Font for new texts (the selected text's own font is on the text).
  const [fontFamily, setFontFamily] =
    useState(DEFAULT_FONT);

  // Which tool panel is open next to the icon rail.
  const [tool, setTool] =
    useState('product');

  const [dropActive, setDropActive] =
    useState(false);

  const uploadInputRef =
    useRef(null);

  const replaceInputRef =
    useRef(null);

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

  // Konva measures text hit-areas with these fonts, so load them up front.
  useEffect(() => {
    if (!document.fonts) return;
    WEB_FONTS.forEach(({ family }) => {
      document.fonts
        .load(`20px "${family}"`, 'Aა')
        .catch(() => {});
    });
  }, []);

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

  // Adds a text on top of the stack: the typed text when nothing is
  // selected, otherwise a placeholder the customer edits in place.
  function handleAddText() {
    const text =
      (!selectedText &&
        textInput.trim()) ||
      'ტექსტი';

    const id = newId();

    const created = {
      id,
      text,
      x: TEXT_DEFAULT_X,
      y: TEXT_DEFAULT_Y,
      fontSize,
      rotation: 0,
      fill: textColor,
      fontFamily,
      fontWeight: 'normal',
      fontStyle: 'normal',
      lineHeight: 1,
      letterSpacing: 0,
      textScaleX: 1,
      textScaleY: 1,
      visible: true,
      layerName: text,
      z: nextZ(),
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
    setTool('text');
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

  const handlePhotoUpload = (
    e
  ) => {
    addImageFile(e.target.files[0]);
    e.target.value = '';
  };

  function addImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const id = String(newId());
    const z = nextZ();

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
                id,
                z,
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

    setSelectedId(id);
    setTool('image');
  }


  const selectedText =
    textObjects.find(
      (item) =>
        item.id === selectedId
    ) || null;

  const selectedImage =
    images.find(
      (item) =>
        item.id === selectedId
    ) || null;

  // Selecting an object (on the canvas or in the layer list) also opens
  // its tool panel.
  const selectObject = (id, kind) => {
    setSelectedId(id);
    if (kind) setTool(kind);
  };

  // Bottom → top, the order both the editor and the print texture draw in.
  const stack = sortByStack(images, textObjects);

  const nextZ = () =>
    stack.reduce(
      (max, item) => Math.max(max, item.z),
      -1
    ) + 1;

  // record=false for live slider drags; commitHistory() on release.
  const updateText = (id, patch, record = true) => {
    const next = textObjects.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    setTextObjects(next);
    if (record) saveHistory(images, next);
  };

  const updateImage = (id, patch, record = true) => {
    const next = images.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    setImages(next);
    if (record) saveHistory(next, textObjects);
  };

  const commitHistory = () =>
    saveHistory(images, textObjects);

  // Swap an object with its neighbour in the stack (dir +1 = up).
  const moveLayer = (id, dir) => {
    const from = stack.findIndex(
      (item) => item.node.id === id
    );
    const to = from + dir;
    if (from < 0 || to < 0 || to >= stack.length) return;

    const order = [...stack];
    [order[from], order[to]] = [order[to], order[from]];

    const zOf = new Map(
      order.map((item, z) => [item.node, z])
    );
    const nextImages = images.map((item) => ({
      ...item,
      z: zOf.get(item),
    }));
    const nextTexts = textObjects.map((item) => ({
      ...item,
      z: zOf.get(item),
    }));

    setImages(nextImages);
    setTextObjects(nextTexts);
    saveHistory(nextImages, nextTexts);
  };

  const alignSelectedImage = (where) => {
    if (!selectedImage) return;
    const w =
      (selectedImage.width ?? UPLOAD_BOX) *
      (selectedImage.scale ?? 1);
    const x =
      where === 'l'
        ? 0
        : where === 'r'
        ? CANVAS_WIDTH - w
        : (CANVAS_WIDTH - w) / 2;
    updateImage(selectedImage.id, { x: clampPos(x) });
  };

  // Swap the selected image's file, keeping its position and transform.
  const replaceSelectedImage = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !selectedImage) return;

    const target = selectedImage;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target.result;
      const probe = new Image();
      probe.onload = () => {
        const renamed =
          !target.layerName ||
          target.layerName === target.name;
        updateImage(target.id, {
          src,
          name: file.name,
          ...(renamed ? { layerName: file.name } : {}),
          ...fitBox(probe.naturalWidth, probe.naturalHeight),
        });
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  };

  // The text box edits the selected text, or drafts the next new one.
  const editText = (value) => {
    if (!selectedText) {
      setTextInput(value);
      return;
    }
    const keepName =
      selectedText.layerName &&
      selectedText.layerName !== selectedText.text;
    updateText(
      selectedText.id,
      {
        text: value,
        ...(keepName ? {} : { layerName: value }),
      },
      false
    );
  };

  const pickFont = (family) => {
    setFontFamily(family);
    if (selectedText) {
      updateText(selectedText.id, { fontFamily: family });
    }
  };

  const cycleFont = () => {
    if (!selectedText) return;
    const i = ALL_FONTS.indexOf(selectedText.fontFamily);
    pickFont(ALL_FONTS[(i + 1) % ALL_FONTS.length]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDropActive(false);
    addImageFile(e.dataTransfer.files[0]);
  };

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
        priceOf(orderProduct),

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

  const unitPrice = orderProduct
    ? priceOf(orderProduct)
    : null;

  const flipCls =
    flipPhase === 'out'
      ? s.flipOut
      : flipPhase ===
        'in'
      ? s.flipIn
      : '';

  const shirtColorInfo =
    SHIRT_COLORS.find((c) => c.key === shirtColor) ?? SHIRT_COLORS[0];

  // Lowest active price per category, for the product cards.
  const fromPrice = (category) => {
    const prices = (products ?? [])
      .filter((p) => p.category === category && priceOf(p) > 0)
      .map(priceOf);
    return prices.length ? Math.min(...prices) : null;
  };

  const visibleCount = (side) =>
    designs[side].images.filter((i) => i.visible !== false).length +
    designs[side].textObjects.filter((t) => t.visible !== false).length;

  const frontCount = visibleCount('front');
  const backCount = supportsBackPrint ? visibleCount('back') : 0;

  const designLabel =
    frontCount + backCount === 0
      ? 'ცარიელი'
      : `${frontCount + backCount} ელემენტი · ${[
          frontCount && 'წინა',
          backCount && 'უკანა',
        ]
          .filter(Boolean)
          .join(' + ')}`;

  const variantLabel =
    activeTab === 'tshirt'
      ? gender === 'man'
        ? 'კაცი'
        : 'ქალი'
      : activeTab === 'hoodie'
      ? HOODIE_STYLES.find((st) => st.id === hoodieStyle)?.label
      : null;

  const thumbSrc = activeTab === 'tshirt' ? currentSrc : activeCat.front;
  const thumbFilter =
    activeTab === 'tshirt' ? 'none' : COLOR_FILTERS[shirtColor] ?? 'none';

  // Editing is paused while the customer orbits the 3D model.
  const canEdit = !is3DMode;
  const backIsEmpty =
    is3D &&
    supportsBackPrint &&
    editSide === 'back' &&
    designs.back.images.length + designs.back.textObjects.length === 0;

  const layerList = [...stack].reverse();

  const canUndo = historyStep > 0;
  const canRedo = historyStep < history.length - 1;

  return (
    <div className={s.page}>
      {/* TOOL RAIL */}

      <nav className={s.rail} aria-label="ინსტრუმენტები">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${s.railBtn} ${tool === t.id ? s.railBtnActive : ''}`}
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
          >
            {ICONS[t.id]}
            {t.label}
          </button>
        ))}
      </nav>

      {/* TOOL PANEL + LAYERS */}

      <aside className={s.toolPanel}>
        <div className={s.toolBody}>
          {tool === 'product' && (
            <>
              <div>
                <div className={s.panelTitle}>პროდუქტი</div>
                <div className={s.panelSub}>აირჩიეთ ტიპი და მოდელი</div>
              </div>

              <div className={s.productGrid}>
                {CATEGORIES.map((c) => {
                  const from = c.category ? fromPrice(c.category) : null;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`${s.productCard} ${
                        activeTab === c.id ? s.productCardActive : ''
                      }`}
                      aria-pressed={activeTab === c.id}
                      onClick={() => switchTab(c.id)}
                    >
                      <span className={s.productThumb}>
                        <img src={c.front} alt="" draggable={false} />
                      </span>
                      <span className={s.productCardName}>{c.label}</span>
                      <span className={s.productCardPrice}>
                        {from !== null ? `${from} ₾-დან` : 'მალე'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeTab === 'tshirt' && (
                <div className={s.field}>
                  <div className={s.fieldLabel}>სქესი</div>
                  <div className={s.segment} role="group" aria-label="სქესი">
                    {[
                      ['man', 'კაცი'],
                      ['woman', 'ქალი'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={gender === id}
                        className={`${s.segmentBtn} ${
                          gender === id ? s.segmentBtnActive : ''
                        }`}
                        onClick={() => setGender(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'hoodie' && (
                <div className={s.field}>
                  <div className={s.fieldLabel}>მოდელი</div>
                  <div className={s.chips} role="group" aria-label="ჰუდის სტილი">
                    {HOODIE_STYLES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        aria-pressed={hoodieStyle === st.id}
                        className={`${s.chip} ${
                          hoodieStyle === st.id ? s.chipActive : ''
                        }`}
                        onClick={() => switchHoodieStyle(st.id)}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tool === 'color' && (
            <>
              <div>
                <div className={s.panelTitle}>ფერი</div>
                <div className={s.panelSub}>არჩეული: {shirtColorInfo.name}</div>
              </div>

              <div className={s.swatchGrid}>
                {SHIRT_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={s.swatchBtn}
                    aria-pressed={shirtColor === c.key}
                    onClick={() => setShirtColor(c.key)}
                  >
                    <span
                      className={`${s.swatch} ${
                        shirtColor === c.key ? s.swatchActive : ''
                      }`}
                      style={{ background: c.hex }}
                    />
                    <span className={s.swatchName}>{c.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {tool === 'text' && (
            <>
              <div>
                <div className={s.panelTitle}>ტექსტი</div>
                <div className={s.panelSub}>
                  {selectedText
                    ? 'დაარედაქტირეთ არჩეული ტექსტი'
                    : 'ჩაწერეთ და დაამატეთ ახალი ტექსტი'}
                </div>
              </div>

              <textarea
                className={s.textArea}
                rows={2}
                placeholder="ტექსტი..."
                value={selectedText ? selectedText.text : textInput}
                onChange={(e) => editText(e.target.value)}
                onBlur={() => selectedText && commitHistory()}
              />

              <div className={s.field}>
                <div className={s.fieldLabel}>შრიფტი</div>
                <div className={s.fontGrid}>
                  {WEB_FONTS.map((f) => {
                    const active =
                      (selectedText?.fontFamily ?? fontFamily) === f.family;
                    return (
                      <button
                        key={f.family}
                        type="button"
                        aria-pressed={active}
                        className={`${s.fontCard} ${active ? s.fontCardActive : ''}`}
                        onClick={() => pickFont(f.family)}
                      >
                        <span
                          className={s.fontSample}
                          style={{ fontFamily: `'${f.family}'` }}
                        >
                          Aa ა
                        </span>
                        <span className={s.fontName}>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
                <select
                  className={s.select}
                  aria-label="სხვა შრიფტები"
                  value={
                    FONT_FAMILIES.includes(selectedText?.fontFamily ?? fontFamily)
                      ? selectedText?.fontFamily ?? fontFamily
                      : ''
                  }
                  onChange={(e) => e.target.value && pickFont(e.target.value)}
                >
                  <option value="">სხვა შრიფტები…</option>
                  {FONT_FAMILIES.map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </select>
              </div>

              <div className={s.sliders}>
                <label className={s.sliderField}>
                  <span className={s.sliderHead}>
                    <span>ზომა</span>
                    <b>{Math.round(selectedText?.fontSize ?? fontSize)} px</b>
                  </span>
                  <input
                    type="range"
                    min="8"
                    max="120"
                    value={Math.round(selectedText?.fontSize ?? fontSize)}
                    onChange={(e) =>
                      selectedText
                        ? updateText(
                            selectedText.id,
                            { fontSize: clampFont(+e.target.value) },
                            false
                          )
                        : handleFontSizeChange(+e.target.value)
                    }
                    onPointerUp={() => selectedText && commitHistory()}
                    onKeyUp={() => selectedText && commitHistory()}
                  />
                </label>

                {selectedText && (
                  <div className={s.sliderPair}>
                    <label className={s.sliderField}>
                      <span className={s.sliderHead}>
                        <span>ინტერვალი</span>
                        <b>{selectedText.letterSpacing ?? 0}</b>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={selectedText.letterSpacing ?? 0}
                        onChange={(e) =>
                          updateText(
                            selectedText.id,
                            { letterSpacing: +e.target.value },
                            false
                          )
                        }
                        onPointerUp={commitHistory}
                        onKeyUp={commitHistory}
                      />
                    </label>

                    <label className={s.sliderField}>
                      <span className={s.sliderHead}>
                        <span>ბრუნვა</span>
                        <b>{selectedText.rotation ?? 0}°</b>
                      </span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={selectedText.rotation ?? 0}
                        onChange={(e) =>
                          updateText(
                            selectedText.id,
                            { rotation: clampRot(+e.target.value) },
                            false
                          )
                        }
                        onPointerUp={commitHistory}
                        onKeyUp={commitHistory}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className={s.field}>
                <div className={s.fieldLabel}>ტექსტის ფერი</div>
                <div className={s.textColors}>
                  {TEXT_COLORS.map((c) => {
                    const active = (selectedText?.fill ?? textColor) === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        aria-pressed={active}
                        className={`${s.textSwatch} ${active ? s.swatchActive : ''}`}
                        style={{ background: c }}
                        onClick={() => {
                          setTextColor(c);
                          if (selectedText) updateText(selectedText.id, { fill: c });
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {selectedText && (
                <button
                  type="button"
                  className={s.linkBtn}
                  onClick={() =>
                    updateText(selectedText.id, {
                      fontFamily: DEFAULT_FONT,
                      fontWeight: 'normal',
                      fontStyle: 'normal',
                      fontSize: 28,
                      lineHeight: 1,
                      letterSpacing: 0,
                      textScaleX: 1,
                      textScaleY: 1,
                      rotation: 0,
                      fill: '#1a1a1a',
                    })
                  }
                >
                  პარამეტრების დარესეტება
                </button>
              )}

              <button
                type="button"
                className={s.dashedBtn}
                onClick={handleAddText}
              >
                + ახალი ტექსტის დამატება
              </button>
            </>
          )}

          {tool === 'image' && (
            <>
              <div>
                <div className={s.panelTitle}>სურათი</div>
                <div className={s.panelSub}>ატვირთეთ ლოგო ან ფოტო</div>
              </div>

              <button
                type="button"
                className={`${s.dropzone} ${dropActive ? s.dropzoneActive : ''}`}
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={handleDrop}
              >
                <span className={s.dropIcon}>{ICONS.upload}</span>
                <span className={s.dropTitle}>ჩააგდეთ ფაილი ან აირჩიეთ</span>
                <span className={s.dropHint}>PNG, JPG, WEBP, GIF</span>
              </button>

              <input
                ref={uploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={handlePhotoUpload}
              />

              {selectedImage ? (
                <>
                  <div className={s.sliders}>
                    <label className={s.sliderField}>
                      <span className={s.sliderHead}>
                        <span>მასშტაბი</span>
                        <b>{Math.round((selectedImage.scale ?? 1) * 100)}%</b>
                      </span>
                      <input
                        type="range"
                        min="10"
                        max="300"
                        value={Math.round((selectedImage.scale ?? 1) * 100)}
                        onChange={(e) =>
                          updateImage(
                            selectedImage.id,
                            { scale: clampScale(+e.target.value / 100) },
                            false
                          )
                        }
                        onPointerUp={commitHistory}
                        onKeyUp={commitHistory}
                      />
                    </label>

                    <label className={s.sliderField}>
                      <span className={s.sliderHead}>
                        <span>ბრუნვა</span>
                        <b>{selectedImage.rotation ?? 0}°</b>
                      </span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={selectedImage.rotation ?? 0}
                        onChange={(e) =>
                          updateImage(
                            selectedImage.id,
                            { rotation: clampRot(+e.target.value) },
                            false
                          )
                        }
                        onPointerUp={commitHistory}
                        onKeyUp={commitHistory}
                      />
                    </label>

                    <label className={s.sliderField}>
                      <span className={s.sliderHead}>
                        <span>გამჭვირვალობა</span>
                        <b>{Math.round((selectedImage.opacity ?? 1) * 100)}%</b>
                      </span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={Math.round((selectedImage.opacity ?? 1) * 100)}
                        onChange={(e) =>
                          updateImage(
                            selectedImage.id,
                            { opacity: clampOpacity(+e.target.value / 100) },
                            false
                          )
                        }
                        onPointerUp={commitHistory}
                        onKeyUp={commitHistory}
                      />
                    </label>
                  </div>

                  <div className={s.field}>
                    <div className={s.fieldLabel}>პოზიცია</div>
                    <div className={s.alignRow}>
                      {[
                        ['l', 'მარცხნივ'],
                        ['c', 'ცენტრში'],
                        ['r', 'მარჯვნივ'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={s.alignBtn}
                          onClick={() => alignSelectedImage(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                images.length > 0 && (
                  <div className={s.hintBox}>
                    აირჩიეთ სურათი ლეიერებიდან ან კანვასზე, რომ შეცვალოთ
                  </div>
                )
              )}
            </>
          )}
        </div>

        <div className={s.layers}>
          <div className={s.layersHead}>
            {ICONS.layers}
            <span>ლეიერები</span>
            <span className={s.countBadge}>{layerList.length}</span>
            {supportsBackPrint && (
              <span className={s.layersSide}>
                {editSide === 'back' ? GEO.back : GEO.front}
              </span>
            )}
          </div>

          {layerList.length === 0 ? (
            <div className={s.layersEmpty}>
              ჯერ ობიექტები არ არის — დაამატეთ ტექსტი ან სურათი
            </div>
          ) : (
            <div className={s.layerList}>
              {layerList.map(({ kind, node }, index) => {
                const isText = kind === 'text';
                const hidden = node.visible === false;
                const active = selectedId === node.id;
                const fallbackName = isText
                  ? node.text || 'ტექსტი'
                  : node.name || 'სურათი';

                return (
                  <div
                    key={`${kind}-${node.id}`}
                    className={`${s.layerRow} ${active ? s.layerRowActive : ''} ${
                      hidden ? s.layerRowHidden : ''
                    }`}
                    onClick={() => !hidden && selectObject(node.id, kind)}
                  >
                    <span className={s.layerGlyph}>
                      {isText ? 'T' : <img src={node.src} alt="" />}
                    </span>

                    <div className={s.layerText}>
                      <input
                        className={s.layerName}
                        value={node.layerName ?? fallbackName}
                        aria-label="ლეიერის სახელი"
                        onChange={(e) =>
                          renameLayer(kind, node.id, e.target.value)
                        }
                      />
                      <span className={s.layerKind}>
                        {isText
                          ? `ტექსტი · ${fontLabel(node.fontFamily ?? 'Arial')}`
                          : `სურათი · ${Math.round((node.scale ?? 1) * 100)}%`}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={s.iconBtn}
                      title={hidden ? 'გამოჩენა' : 'დამალვა'}
                      aria-label={hidden ? 'ობიექტის გამოჩენა' : 'ობიექტის დამალვა'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(kind, node.id);
                      }}
                    >
                      {hidden ? ICONS.eyeOff : ICONS.eye}
                    </button>
                    <button
                      type="button"
                      className={s.iconBtnSm}
                      title="ზემოთ"
                      aria-label="ზემოთ გადატანა"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(node.id, 1);
                      }}
                    >
                      {ICONS.up}
                    </button>
                    <button
                      type="button"
                      className={s.iconBtnSm}
                      title="ქვემოთ"
                      aria-label="ქვემოთ გადატანა"
                      disabled={index === layerList.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(node.id, -1);
                      }}
                    >
                      {ICONS.down}
                    </button>
                    <button
                      type="button"
                      className={`${s.iconBtn} ${s.iconBtnDanger}`}
                      title="წაშლა"
                      aria-label="ობიექტის წაშლა"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(kind, node.id);
                      }}
                    >
                      {ICONS.trash}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* STAGE */}

      <main className={s.stage}>
        <div className={s.stageTopLeft}>
          <button
            type="button"
            className={s.floatBtn}
            title="დაბრუნება (Ctrl+Z)"
            aria-label="დაბრუნება"
            disabled={!canUndo}
            onClick={undo}
          >
            {ICONS.undo}
          </button>
          <button
            type="button"
            className={s.floatBtn}
            title="გამეორება (Ctrl+Y)"
            aria-label="გამეორება"
            disabled={!canRedo}
            onClick={redo}
          >
            {ICONS.redo}
          </button>
        </div>

        {canEdit && selectedText && (
          <div className={s.contextBar}>
            <button
              type="button"
              className={s.ctxPill}
              title="შრიფტის შეცვლა"
              onClick={cycleFont}
            >
              {fontLabel(selectedText.fontFamily ?? 'Arial')}
              <Icon d="m6 9 6 6 6-6" size={12} width={2.4} />
            </button>
            <span className={s.ctxSep} />
            <button
              type="button"
              className={s.ctxBtn}
              aria-label="შემცირება"
              onClick={() =>
                updateText(selectedText.id, {
                  fontSize: clampFont((selectedText.fontSize ?? 28) - 2),
                })
              }
            >
              −
            </button>
            <span className={s.ctxValue}>{Math.round(selectedText.fontSize ?? 28)}</span>
            <button
              type="button"
              className={s.ctxBtn}
              aria-label="გაზრდა"
              onClick={() =>
                updateText(selectedText.id, {
                  fontSize: clampFont((selectedText.fontSize ?? 28) + 2),
                })
              }
            >
              +
            </button>
            <span className={s.ctxSep} />
            <button
              type="button"
              className={s.ctxDot}
              title="ტექსტის ფერი"
              aria-label="ტექსტის ფერი"
              style={{ background: selectedText.fill ?? '#000' }}
              onClick={() => setTool('text')}
            />
            <button
              type="button"
              className={`${s.ctxBtn} ${selectedText.fontWeight === 'bold' ? s.ctxBtnOn : ''}`}
              aria-pressed={selectedText.fontWeight === 'bold'}
              aria-label="Bold"
              style={{ fontWeight: 800 }}
              onClick={() =>
                updateText(selectedText.id, {
                  fontWeight: selectedText.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
            >
              B
            </button>
            <button
              type="button"
              className={`${s.ctxBtn} ${selectedText.fontStyle === 'italic' ? s.ctxBtnOn : ''}`}
              aria-pressed={selectedText.fontStyle === 'italic'}
              aria-label="Italic"
              style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
              onClick={() =>
                updateText(selectedText.id, {
                  fontStyle: selectedText.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
            >
              I
            </button>
            <span className={s.ctxSep} />
            <span className={s.ctxMeta}>
              {ICONS.rotate}
              {selectedText.rotation ?? 0}°
            </span>
            <button
              type="button"
              className={`${s.ctxBtn} ${s.ctxDanger}`}
              title="წაშლა"
              aria-label="წაშლა"
              onClick={deleteSelectedObject}
            >
              {ICONS.trash}
            </button>
          </div>
        )}

        {canEdit && selectedImage && (
          <div className={s.contextBar}>
            <button
              type="button"
              className={s.ctxPill}
              onClick={() => replaceInputRef.current?.click()}
            >
              ჩანაცვლება
            </button>
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={replaceSelectedImage}
            />
            <span className={s.ctxSep} />
            <button
              type="button"
              className={s.ctxBtn}
              aria-label="შემცირება"
              onClick={() =>
                updateImage(selectedImage.id, {
                  scale: clampScale((selectedImage.scale ?? 1) - 0.1),
                })
              }
            >
              −
            </button>
            <span className={s.ctxValue}>
              {Math.round((selectedImage.scale ?? 1) * 100)}%
            </span>
            <button
              type="button"
              className={s.ctxBtn}
              aria-label="გაზრდა"
              onClick={() =>
                updateImage(selectedImage.id, {
                  scale: clampScale((selectedImage.scale ?? 1) + 0.1),
                })
              }
            >
              +
            </button>
            <span className={s.ctxSep} />
            <button
              type="button"
              className={s.ctxPillPlain}
              title="90°-ით მობრუნება"
              onClick={() =>
                updateImage(selectedImage.id, {
                  rotation: ((((selectedImage.rotation ?? 0) + 90 + 180) % 360) + 360) % 360 - 180,
                })
              }
            >
              {ICONS.rotate}
              {selectedImage.rotation ?? 0}°
            </button>
            <span className={s.ctxMeta}>
              {Math.round((selectedImage.opacity ?? 1) * 100)}%
            </span>
            <button
              type="button"
              className={`${s.ctxBtn} ${s.ctxDanger}`}
              title="წაშლა"
              aria-label="წაშლა"
              onClick={deleteSelectedObject}
            >
              {ICONS.trash}
            </button>
          </div>
        )}

        <div className={is3D ? s.viewer3D : s.viewerFlat}>
          <div
            className={`${is3D ? s.viewBox3D : s.viewBoxFlat} ${flipCls}`}
          >
            <div
              ref={viewerRef}
              className={is3D ? s.canvas3D : s.canvasFlat}
            >
              {is3D ? (
                <ShirtViewer3D
                  color={shirtHex}
                  designCanvas={designCanvas}
                  designRev={designRev}
                  view={view3d}
                  viewResetKey={view3dResetKey}
                  interactive={is3DMode}
                  onPrintAreaChange={handlePrintArea}
                  productType={modelType}
                  backDesignCanvas={
                    supportsBackPrint ? backDesignCanvas : null
                  }
                  backDesignRev={backDesignRev}
                  printSide={editSide}
                />
              ) : (
                <img
                  src={currentSrc}
                  alt={activeCat.label}
                  draggable={false}
                  className={s.flatImage}
                  style={{ filter: activeFilter }}
                />
              )}
            </div>

            <div
              style={
                is3D
                  ? {
                      position: 'absolute',
                      left: printRect ? `${printRect.left}px` : '50%',
                      top: printRect ? `${printRect.top}px` : '0px',
                      width: CANVAS_WIDTH + 'px',
                      height: CANVAS_HEIGHT + 'px',
                      margin: 0,
                      padding: 0,
                      transformOrigin: 'top left',
                      transform: printRect
                        ? `scale(${printRect.width / CANVAS_WIDTH}, ${
                            printRect.height / CANVAS_HEIGHT
                          })`
                        : 'translateX(-50%)',
                      opacity: printRect && printRect.visible ? 1 : 0,
                      // A hidden overlay (print side facing away) must not
                      // swallow clicks meant for the viewer or the buttons.
                      pointerEvents:
                        !is3DMode && printRect && printRect.visible
                          ? 'auto'
                          : 'none',
                      transition: 'opacity 0.2s ease',
                    }
                  : {
                      position: 'absolute',
                      top: '-15px',
                      left: '33px',
                      width: CANVAS_WIDTH + 'px',
                      height: CANVAS_HEIGHT + 'px',
                      margin: 0,
                      padding: 0,
                      opacity: 1,
                      pointerEvents: is3DMode ? 'none' : 'auto',
                    }
              }
            >
              <Stage
                ref={stageRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) {
                    setSelectedId(null);
                  }
                }}
                onTap={(e) => {
                  if (e.target === e.target.getStage()) {
                    setSelectedId(null);
                  }
                }}
              >
                <Layer>
                  {stack
                    .filter(({ node }) => node.visible !== false)
                    .map(({ kind, node }) =>
                      kind === 'image' ? (
                        <DesignImage
                          key={`image-${node.id}`}
                          imgData={node}
                          isSelected={selectedId === node.id}
                          is3DProduct={is3D}
                          is3DMode={is3DMode}
                          onSelect={() => selectObject(node.id, 'image')}
                          onChange={(newProps, opts) => {
                            setImages((prev) => {
                              const next = prev.map((i) =>
                                i.id === node.id ? { ...i, ...newProps } : i
                              );

                              if (!opts?.silent) {
                                saveHistory(next, textObjects);
                              }

                              return next;
                            });
                          }}
                        />
                      ) : (
                        <TextItem
                          key={`text-${node.id}`}
                          node={node}
                          isSelected={selectedId === node.id}
                          is3DProduct={is3D}
                          is3DMode={is3DMode}
                          onSelect={() => selectObject(node.id, 'text')}
                          onChange={(newProps, opts) => {
                            setTextObjects((prev) => {
                              const next = prev.map((item) =>
                                item.id === node.id
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
                      )
                    )}
                </Layer>
              </Stage>
            </div>
          </div>
        </div>

        {backIsEmpty && !is3DMode && (
          <div className={s.emptyBack}>
            უკანა მხარე ცარიელია
            <button type="button" onClick={handleAddText}>
              + ტექსტი
            </button>
            <button
              type="button"
              onClick={() => {
                setTool('image');
                uploadInputRef.current?.click();
              }}
            >
              + სურათი
            </button>
          </div>
        )}

        {is3DMode && (
          <div className={s.orbitHint}>
            {ICONS.rotate}
            გადაათრიეთ მოსაბრუნებლად
          </div>
        )}

        <div className={s.viewDock}>
          {is3D ? (
            <>
              <button
                type="button"
                className={`${s.dockBtn} ${view3d === 'front' ? s.dockBtnActive : ''}`}
                aria-pressed={view3d === 'front'}
                onClick={showFront}
              >
                {ICONS.front}
                {GEO.front}
              </button>
              <button
                type="button"
                className={`${s.dockBtn} ${view3d === 'back' ? s.dockBtnActive : ''}`}
                aria-pressed={view3d === 'back'}
                onClick={showBack}
              >
                {ICONS.back}
                {GEO.back}
              </button>
              <span className={s.dockSep} />
              <button
                type="button"
                className={`${s.dockBtn} ${is3DMode ? s.dockBtnActive : ''}`}
                aria-pressed={is3DMode}
                title="3D რეჟიმში მოდელი თავისუფლად ბრუნავს"
                onClick={toggle3DMode}
              >
                {ICONS.cube}
                3D
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${s.dockBtn} ${side === 'front' ? s.dockBtnActive : ''}`}
                aria-pressed={side === 'front'}
                onClick={() => goToSide('front')}
              >
                {ICONS.front}
                {GEO.front}
              </button>
              <button
                type="button"
                className={`${s.dockBtn} ${side === 'back' ? s.dockBtnActive : ''}`}
                aria-pressed={side === 'back'}
                disabled={!activeCat.hasBack}
                onClick={() => goToSide('back')}
              >
                {ICONS.back}
                {GEO.back}
              </button>
            </>
          )}
        </div>
      </main>

      {/* ORDER PANEL */}

      <aside className={s.orderPanel}>
        <div className={s.orderBody}>
          <div className={s.orderHead}>
            <span className={s.orderThumb}>
              <img src={thumbSrc} alt="" style={{ filter: thumbFilter }} />
            </span>
            <div>
              <div className={s.orderName}>
                {orderProduct ? orderProduct.name : activeCat.label}
              </div>
              <div className={s.orderMeta}>
                {[activeCat.label, variantLabel].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div className={s.summary}>
            <div className={s.summaryRow}>
              <span>ფერი</span>
              <b>
                {shirtColorInfo.name}
                <span
                  className={s.summaryDot}
                  style={{ background: shirtColorInfo.hex }}
                />
              </b>
            </div>
            {orderProduct && (
              <div className={s.summaryRow}>
                <span>{GEO.size}</span>
                <b>{selectedSize}</b>
              </div>
            )}
            <div className={s.summaryRow}>
              <span>დიზაინი</span>
              <b>{designLabel}</b>
            </div>
          </div>

          {/* Sizes come from the product (set in admin); single-size products need no picker. */}
          {orderProduct && sizeOptions.length > 1 && (
            <div className={s.field}>
              <div className={s.orderLabel}>{GEO.size}</div>
              <div className={s.sizeGrid}>
                {sizeOptions.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    aria-pressed={selectedSize === sz}
                    className={`${s.sizeBtn} ${selectedSize === sz ? s.sizeBtnActive : ''}`}
                    onClick={() => setSize(sz)}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={s.qtyRow}>
            <span className={s.orderLabel}>{GEO.qty}</span>
            <div className={s.qtyControl}>
              <button
                type="button"
                className={s.qtyBtn}
                aria-label="შემცირება"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className={s.qtyVal}>{quantity}</span>
              <button
                type="button"
                className={s.qtyBtn}
                aria-label="გაზრდა"
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className={s.priceRows}>
            <div>
              <span>ერთეულის ფასი</span>
              <span>{unitPrice !== null ? formatPrice(unitPrice) : '—'}</span>
            </div>
            <div>
              <span>{GEO.qty}</span>
              <span>× {quantity}</span>
            </div>
          </div>
        </div>

        <div className={s.orderFoot}>
          <div className={s.totalRow}>
            <span>სულ</span>
            <b>
              {unitPrice !== null
                ? formatPrice(unitPrice * quantity)
                : '—'}
            </b>
          </div>

          <button
            type="button"
            className={s.orderBtn}
            onClick={handleAddToCart}
            disabled={!orderProduct}
          >
            {GEO.order}
          </button>

          <button
            type="button"
            className={`${s.cartBtn} ${cartAdded ? s.cartBtnAdded : ''}`}
            onClick={handleAddToCart}
            disabled={cartAdded || !orderProduct}
          >
            {ICONS.cart}
            {cartAdded ? '✓ დამატებულია' : 'კალათაში დამატება'}
          </button>

          {!orderProduct && (
            <div className={s.notForSale}>ეს პროდუქტი ჯერ არ იყიდება</div>
          )}
        </div>
      </aside>
    </div>
  );
}
