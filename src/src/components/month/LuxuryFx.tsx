import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { UNIT_BOX } from '../models/materials';

const COIN_COUNT = 18;
const BILL_COUNT = 12;
const SPARK_COUNT = 28;

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

const COIN_BODY = new CylinderGeometry(0.5, 0.5, 0.28, 40);
const COIN_RIM = new TorusGeometry(0.5, 0.075, 12, 40);
const COIN_FACE = new CircleGeometry(0.455, 40);
const BILL_FACE = new PlaneGeometry(1.35, 0.63);

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
const COIN_FACE_MAT = new MeshBasicMaterial({
  side: DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
const BILL_EDGE_MAT = new MeshStandardMaterial({ color: '#8fb56e', roughness: 0.86, metalness: 0 });
const BILL_FACE_MAT = new MeshBasicMaterial({
  side: DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

/** 縦棒と横棒を1枚の十字にする。インスタンスのスケールで点滅させる。 */
const SPARK_CROSS = new BufferGeometry();
SPARK_CROSS.setAttribute(
  'position',
  new Float32BufferAttribute(
    [
      -0.07, -0.5, 0, 0.07, -0.5, 0, 0.07, 0.5, 0,
      -0.07, -0.5, 0, 0.07, 0.5, 0, -0.07, 0.5, 0,
      -0.5, -0.07, 0, 0.5, -0.07, 0, 0.5, 0.07, 0,
      -0.5, -0.07, 0, 0.5, 0.07, 0, -0.5, 0.07, 0,
    ],
    3,
  ),
);
const SPARK_MAT = new MeshBasicMaterial({
  color: '#ffffff',
  side: DoubleSide,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  toneMapped: false,
});
const SPARK_WHITE = new Color('#fff6c8');
const SPARK_GOLD = new Color('#ffe27a');
const sparkTint = new Color();

const CURRENCY_FONT = '400px "DotGothic16"';

/** 書体が載ってから面を描き、既存マテリアルの map を差し替える。使えなければ投げる。 */
const applyCurrencyFaces = (): Promise<void> =>
  document.fonts.ready.then(() => document.fonts.load(CURRENCY_FONT)).then((loaded) => {
    if (!document.fonts.check(CURRENCY_FONT)) {
      throw new Error(
        `LuxuryFx: DotGothic16 が使えません (loaded=${String(loaded.length)}, status=${loaded.map((face) => `${face.family}:${face.status}`).join(',') || 'none'})`,
      );
    }
    const previousCoin = COIN_FACE_MAT.map;
    const previousBill = BILL_FACE_MAT.map;
    COIN_FACE_MAT.map = paintCoinFace();
    BILL_FACE_MAT.map = paintBillFace();
    COIN_FACE_MAT.needsUpdate = true;
    BILL_FACE_MAT.needsUpdate = true;
    previousCoin?.dispose();
    previousBill?.dispose();
  });

void applyCurrencyFaces();

const root = new Object3D();
const part = new Object3D();
const composed = new Matrix4();

const place = (mesh: InstancedMesh, index: number) => {
  part.updateMatrix();
  composed.multiplyMatrices(root.matrix, part.matrix);
  mesh.setMatrixAt(index, composed);
};

/** 厚みのある金貨と、紙の厚みがある札。文字は DotGothic16。 */
export const LuxuryFx = () => {
  const coins = useRef<InstancedMesh>(null);
  const rims = useRef<InstancedMesh>(null);
  const faces = useRef<InstancedMesh>(null);
  const backs = useRef<InstancedMesh>(null);
  const bills = useRef<InstancedMesh>(null);
  const billFront = useRef<InstancedMesh>(null);
  const billBack = useRef<InstancedMesh>(null);
  const sparks = useRef<InstancedMesh>(null);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const coinMesh = coins.current;
    const rimMesh = rims.current;
    const faceMesh = faces.current;
    const backMesh = backs.current;
    const billMesh = bills.current;
    const frontMesh = billFront.current;
    const rearMesh = billBack.current;
    const sparkMesh = sparks.current;
    if (!coinMesh || !rimMesh || !faceMesh || !backMesh || !billMesh || !frontMesh || !rearMesh || !sparkMesh) {
      return;
    }

    for (let i = 0; i < COIN_COUNT; i++) {
      const column = i % 6;
      const row = Math.floor(i / 6);
      const x = ((column + 0.5) / 6) * 10 - 5;
      const z = ((row + 0.5) / 3) * 8 - 4;
      const fall = (t * 0.35 + i * 0.17) % 1;
      const y = 6.2 - fall * 5.4;
      const size = 0.39 + (i % 4) * 0.06;
      root.position.set(x, y, z);
      root.rotation.set(0.62 + Math.sin(t * 0.7 + i) * 0.22, t * 0.35 + i, Math.sin(t + i) * 0.2);
      root.scale.setScalar(size);
      root.updateMatrix();

      part.position.set(0, 0, 0);
      part.rotation.set(0, 0, 0);
      part.scale.set(1, 1, 1);
      place(coinMesh, i);

      part.rotation.set(Math.PI / 2, 0, 0);
      place(rimMesh, i);

      part.position.set(0, 0.142, 0);
      part.rotation.set(-Math.PI / 2, 0, 0);
      part.scale.set(1, 1, 1);
      place(faceMesh, i);

      part.position.set(0, -0.142, 0);
      part.rotation.set(Math.PI / 2, 0, 0);
      place(backMesh, i);
    }

    for (let i = 0; i < BILL_COUNT; i++) {
      const column = i % 4;
      const row = Math.floor(i / 4);
      const x = ((column + 0.5) / 4) * 9 - 4.2;
      const z = ((row + 0.5) / 3) * 7 - 3.2;
      const fall = (t * 0.22 + i * 0.21) % 1;
      const y = 5.6 - fall * 4.6;
      const size = 0.58 + (i % 3) * 0.06;
      root.position.set(x, y, z);
      root.rotation.set(0.35 + Math.sin(t * 0.8 + i) * 0.2, 0.4 + Math.sin(t * 0.35 + i) * 0.7, Math.sin(t * 1.1 + i) * 0.18);
      root.scale.setScalar(size);
      root.updateMatrix();

      part.position.set(0, 0, 0);
      part.rotation.set(0, 0, 0);
      part.scale.set(1.35, 0.63, 0.04);
      place(billMesh, i);

      part.position.set(0, 0, 0.022);
      part.rotation.set(0, 0, 0);
      part.scale.set(1, 1, 1);
      place(frontMesh, i);

      part.position.set(0, 0, -0.022);
      part.rotation.set(0, Math.PI, 0);
      place(rearMesh, i);
    }

    part.position.set(0, 0, 0);
    part.rotation.set(0, 0, 0);
    part.scale.set(1, 1, 1);
    if (sparkMesh.instanceColor === null) {
      for (let i = 0; i < SPARK_COUNT; i += 1) {
        sparkTint.copy(SPARK_GOLD).lerp(SPARK_WHITE, (i % 7) / 6);
        sparkMesh.setColorAt(i, sparkTint);
      }
    }
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const angle = (i / SPARK_COUNT) * Math.PI * 2 + (i % 3) * 0.41;
      const x = Math.cos(angle) * (2.1 + (i % 5) * 0.92);
      const z = Math.sin(angle) * (1.4 + (i % 4) * 1.05);
      const yBase = 1.85 + ((i * 11) % SPARK_COUNT) / (SPARK_COUNT - 1) * 4.9;
      const y = yBase + Math.sin(t * 0.42 + i * 0.8) * 0.2;
      const twinkle = 0.5 + 0.5 * Math.sin(t * (0.7 + (i % 5) * 0.12) + i * 1.7);
      const size = (0.22 + (i % 5) * 0.045) * (0.18 + twinkle * 0.82);
      root.position.set(x, y, z);
      root.quaternion.copy(camera.quaternion);
      root.rotateZ(i * 0.55 + t * 0.12);
      root.scale.setScalar(size);
      root.updateMatrix();
      place(sparkMesh, i);
    }

    coinMesh.instanceMatrix.needsUpdate = true;
    rimMesh.instanceMatrix.needsUpdate = true;
    faceMesh.instanceMatrix.needsUpdate = true;
    backMesh.instanceMatrix.needsUpdate = true;
    billMesh.instanceMatrix.needsUpdate = true;
    frontMesh.instanceMatrix.needsUpdate = true;
    rearMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={coins} args={[COIN_BODY, COIN_BODY_MAT, COIN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={rims} args={[COIN_RIM, COIN_RIM_MAT, COIN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={faces} args={[COIN_FACE, COIN_FACE_MAT, COIN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={backs} args={[COIN_FACE, COIN_FACE_MAT, COIN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={bills} args={[UNIT_BOX, BILL_EDGE_MAT, BILL_COUNT]} frustumCulled={false} />
      <instancedMesh ref={billFront} args={[BILL_FACE, BILL_FACE_MAT, BILL_COUNT]} frustumCulled={false} />
      <instancedMesh ref={billBack} args={[BILL_FACE, BILL_FACE_MAT, BILL_COUNT]} frustumCulled={false} />
      <instancedMesh ref={sparks} args={[SPARK_CROSS, SPARK_MAT, SPARK_COUNT]} frustumCulled={false} />
    </group>
  );
};
