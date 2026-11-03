import { useEffect, useMemo, useState } from 'react';
import {
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CelebrationRain, type RainObjectSpec } from '../effects/CelebrationRain';
import { UNIT_BOX } from '../models/materials';

const COIN_COUNT = 18;
const BILL_COUNT = 12;

const paint = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('LuxuryFx: 貨幣の描画に失敗しました');
  }
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

/** 字の形は崩さず、右下に影・左上にハイライトだけ置いて打刻に見せる。 */
const stampGlyph = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  light: string,
  mid: string,
  dark: string,
) => {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = dark;
  ctx.fillText(text, x + 4, y + 5);
  ctx.fillStyle = light;
  ctx.fillText(text, x - 2, y - 3);
  ctx.fillStyle = mid;
  ctx.fillText(text, x, y);
};

const paintCoinFace = (): CanvasTexture => paint(1024, 1024, (ctx) => {
  const c = 512;
  const face = ctx.createRadialGradient(420, 380, 32, c, c, 480);
  face.addColorStop(0, '#fff7c8');
  face.addColorStop(0.42, '#ffd34a');
  face.addColorStop(0.82, '#f0a818');
  face.addColorStop(1, '#c98410');
  ctx.beginPath();
  ctx.arc(c, c, 500, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, 456, 0, Math.PI * 2);
  ctx.strokeStyle = '#fff1b0';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, 420, 0, Math.PI * 2);
  ctx.strokeStyle = '#a86a0e';
  ctx.lineWidth = 8;
  ctx.stroke();

  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 464, c + Math.sin(a) * 464);
    ctx.lineTo(c + Math.cos(a) * 500, c + Math.sin(a) * 500);
    ctx.strokeStyle = i % 2 === 0 ? '#fff6cf' : '#b87510';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(340, 200, 100, 48, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 252, 230, 0.38)';
  ctx.fill();

  ctx.font = '400 460px "DotGothic16"';
  stampGlyph(ctx, '$', c, c + 36, '#fff6c8', '#8a5a0c', '#4a2c06');
});

const paintBillFace = (): CanvasTexture => paint(1024, 480, (ctx) => {
  ctx.fillStyle = '#d7ecc0';
  ctx.fillRect(0, 0, 1024, 480);

  const ground = ctx.createLinearGradient(0, 0, 1024, 0);
  ground.addColorStop(0, '#b7d898');
  ground.addColorStop(0.5, '#e7f6d4');
  ground.addColorStop(1, '#a9cf86');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, 1024, 480);

  for (let x = 20; x < 1020; x += 10) {
    ctx.strokeStyle = 'rgba(20, 80, 36, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x - 70, 456);
    ctx.stroke();
  }

  ctx.strokeStyle = '#14532a';
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 996, 452);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, 960, 416);

  ctx.beginPath();
  ctx.ellipse(530, 248, 108, 156, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c5ddaa';
  ctx.fill();
  ctx.strokeStyle = '#14532a';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#c2a888';
  ctx.beginPath();
  ctx.ellipse(530, 176, 42, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2118';
  ctx.fillRect(498, 158, 64, 14);
  ctx.fillStyle = '#5f8a52';
  ctx.beginPath();
  ctx.moveTo(456, 240);
  ctx.quadraticCurveTo(530, 196, 604, 240);
  ctx.lineTo(586, 372);
  ctx.lineTo(474, 372);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(210, 248, 62, 0, Math.PI * 2);
  ctx.fillStyle = '#e2b340';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#8a5a10';
  ctx.stroke();
  ctx.font = '400 90px "DotGothic16"';
  stampGlyph(ctx, '$', 210, 262, '#fff6d2', '#6a4010', '#3a2208');

  ctx.font = '400 128px "DotGothic16"';
  const corners: Array<[number, number]> = [
    [118, 108],
    [906, 108],
    [118, 378],
    [906, 378],
  ];
  corners.forEach(([x, y]) => {
    stampGlyph(ctx, '100', x, y, '#d7ecc0', '#14532a', '#061f10');
  });

  ctx.font = '400 36px "DotGothic16"';
  ctx.fillStyle = '#14532a';
  ctx.textAlign = 'center';
  ctx.fillText('ONE HUNDRED', 530, 70);
  ctx.fillText('DOLLARS', 530, 432);
});

/**
 * 金貨：胴（円柱）＋縁（トーラス）＋表裏の面（円）を 1 つの geometry に結合し、材質はグループ順の配列。
 * 札：紙の厚みの箱＋表裏の面。
 */
const buildCoinGeometry = () => {
  const body = new CylinderGeometry(0.5, 0.5, 0.28, 40);
  const rim = new TorusGeometry(0.5, 0.075, 12, 40).rotateX(Math.PI / 2);
  const front = new CircleGeometry(0.455, 40).rotateX(-Math.PI / 2).translate(0, 0.142, 0);
  const back = new CircleGeometry(0.455, 40).rotateX(Math.PI / 2).translate(0, -0.142, 0);
  const merged = mergeGeometries([body, rim, front, back], true);
  if (merged === null) {
    throw new Error('LuxuryFx: 金貨の geometry の結合に失敗しました');
  }
  [body, rim, front, back].forEach((g) => g.dispose());
  return merged;
};

const buildBillGeometry = () => {
  const edge = UNIT_BOX.clone().scale(1.35, 0.63, 0.04);
  const front = new PlaneGeometry(1.35, 0.63).translate(0, 0, 0.022);
  const back = new PlaneGeometry(1.35, 0.63).rotateY(Math.PI).translate(0, 0, -0.022);
  const merged = mergeGeometries([edge, front, back], true);
  if (merged === null) {
    throw new Error('LuxuryFx: 札の geometry の結合に失敗しました');
  }
  [edge, front, back].forEach((g) => g.dispose());
  return merged;
};

const COIN_GEOMETRY = buildCoinGeometry();
const BILL_GEOMETRY = buildBillGeometry();

const COIN_BODY_MAT = new MeshStandardMaterial({
  color: '#f0b423',
  roughness: 0.32,
  metalness: 0.4,
});
const COIN_RIM_MAT = new MeshStandardMaterial({
  color: '#d49212',
  roughness: 0.34,
  metalness: 0.38,
});
const BILL_EDGE_MAT = new MeshStandardMaterial({ color: '#8fb56e', roughness: 0.86, metalness: 0 });

/** 面（表裏）用。map は書体が載ってから差す */
const faceMaterial = (map: CanvasTexture | null): MeshBasicMaterial =>
  new MeshBasicMaterial({
    map,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

interface CurrencyFaces {
  coin: CanvasTexture;
  bill: CanvasTexture;
}

const CURRENCY_FONT = '400px "DotGothic16"';

/** 書体が載ってから面を描く。使えなければ投げる（握りつぶさない）。 */
const paintCurrencyFaces = (): Promise<CurrencyFaces> =>
  document.fonts.ready.then(() => document.fonts.load(CURRENCY_FONT)).then((loaded) => {
    if (!document.fonts.check(CURRENCY_FONT)) {
      throw new Error(
        `LuxuryFx: DotGothic16 が使えません (loaded=${String(loaded.length)}, status=${loaded.map((face) => `${face.family}:${face.status}`).join(',') || 'none'})`,
      );
    }
    return { coin: paintCoinFace(), bill: paintBillFace() };
  });

/** 1 回だけ描く。失敗はそのまま unhandled rejection としてコンソールに出る */
const currencyFacesReady = paintCurrencyFaces();

const buildObjects = (faces: CurrencyFaces | null): RainObjectSpec[] => {
  const coinFace = faceMaterial(faces?.coin ?? null);
  const billFace = faceMaterial(faces?.bill ?? null);
  return [
    {
      geometry: COIN_GEOMETRY,
      material: [COIN_BODY_MAT, COIN_RIM_MAT, coinFace, coinFace],
      count: COIN_COUNT,
      scale: { min: 0.36, max: 0.6 },
      spin: { min: 0.5, max: 1.8 },
      fall: { min: 1.4, max: 2.4 },
    },
    {
      geometry: BILL_GEOMETRY,
      material: [BILL_EDGE_MAT, billFace, billFace],
      count: BILL_COUNT,
      scale: { min: 0.55, max: 0.78 },
      spin: { min: 0.4, max: 1.2 },
      fall: { min: 0.8, max: 1.5 },
    },
  ];
};

export interface LuxuryFxProps {
  /** false でフェードアウト。省略時は降り続ける */
  active?: boolean;
}

/** 黄金郷の達成エフェクト：厚みのある金貨と、紙の厚みがある札が降る。文字は DotGothic16。 */
export const LuxuryFx = ({ active = true }: LuxuryFxProps) => {
  // CelebrationRain は材質を複製して使うので、面のテクスチャが載ったら spec を作り直して渡す
  const [faces, setFaces] = useState<CurrencyFaces | null>(null);
  useEffect(() => {
    let mounted = true;
    void currencyFacesReady.then((painted) => {
      if (mounted) setFaces(painted);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const objects = useMemo(() => buildObjects(faces), [faces]);
  useEffect(
    () => () => {
      objects.forEach((spec) => {
        (Array.isArray(spec.material) ? spec.material : [spec.material]).forEach((m) => {
          if (m !== COIN_BODY_MAT && m !== COIN_RIM_MAT && m !== BILL_EDGE_MAT) m.dispose();
        });
      });
    },
    [objects],
  );

  return <CelebrationRain objects={objects} active={active} />;
};
