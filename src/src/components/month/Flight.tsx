import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { Voxel } from '../models/Voxel';

/** 飛行速度（ワールド単位 / 秒） */
const SPEED = 2.4;
/** 塔の屋上での折り返し待機時間（秒） */
const HOLD_SECONDS = 0.8;
/** 離着陸点は塔の天面より少し上 */
const ENDPOINT_LIFT = 0.35;
/** 上の行から。'#' が点灯 */
const HEART_PATTERN = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const HEART_PITCH = 0.055;
const HEART_COLOR = '#ff5d73';
/** クリック用の透明な当たり判定（機体と旗を包む箱）。中心 z と寸法 */
const HIT_BOX_CENTER_Z = -0.25;
const HIT_BOX_SIZE: [number, number, number] = [0.8, 0.7, 1.4];

export interface FlightProps {
  /** 飛行ルートが通る列のワールド x */
  x: number;
  /** 自分の島側の端 z */
  z0: number;
  /** 自分の塔の天面 y */
  y0: number;
  /** 相方の島側の端 z */
  z1: number;
  /** 相方の塔の天面 y */
  y1: number;
  /** 軌道の頂点の高さ。同じ列の全タワーより高くして衝突を避ける */
  apexY: number;
  /** 複数便の位相をずらすためのオフセット（秒） */
  phase: number;
  /** 渡すと機体がクリックできる（友達の島モードで、その日の件数を出す） */
  onClick?: () => void;
}

/** 離陸でゆっくり加速し、着陸前にゆっくり減速する（smoothstep） */
const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/** 2 次ベジェ（z-y 平面）。t=0.5 でほぼ apexY を通る */
const curve = (
  t: number,
  z0: number,
  y0: number,
  z1: number,
  y1: number,
  apexY: number,
): [number, number] => {
  const u = 1 - t;
  const zc = (z0 + z1) / 2;
  const yc = 2 * apexY - (y0 + y1) / 2;
  return [
    u * u * z0 + 2 * u * t * zc + t * t * z1,
    u * u * y0 + 2 * u * t * yc + t * t * y1,
  ];
};

/** ハートの旗を曳いて、ふたりの塔の間を往復するボクセル飛行機（共通の予定の印） */
export const Flight = ({ x, z0, y0, z1, y1, apexY, phase, onClick }: FlightProps) => {
  const root = useRef<Group>(null);
  const heartSpin = useRef<Group>(null);

  const startY = y0 + ENDPOINT_LIFT;
  const endY = y1 + ENDPOINT_LIFT;
  const flightSeconds = (Math.abs(z1 - z0) * 1.2) / SPEED;
  const cycleSeconds = 2 * (flightSeconds + HOLD_SECONDS);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    if (heartSpin.current) {
      heartSpin.current.rotation.y += delta * 1.4;
    }
    const time = (clock.elapsedTime + phase) % cycleSeconds;
    // 行き → 待機 → 帰り → 待機。線形の進み具合を ease して加減速にする
    let linear: number;
    if (time < flightSeconds) {
      linear = time / flightSeconds;
    } else if (time < flightSeconds + HOLD_SECONDS) {
      linear = 1;
    } else if (time < 2 * flightSeconds + HOLD_SECONDS) {
      linear = 1 - (time - flightSeconds - HOLD_SECONDS) / flightSeconds;
    } else {
      linear = 0;
    }
    const outbound = time < flightSeconds + HOLD_SECONDS;
    const t = easeInOut(linear);
    const [z, y] = curve(t, z0, startY, z1, endY, apexY);
    const aheadT = easeInOut(Math.min(1, Math.max(0, linear + (outbound ? 0.02 : -0.02))));
    const [az, ay] = curve(aheadT, z0, startY, z1, endY, apexY);
    g.position.set(x, y, z);
    if (aheadT !== t) {
      g.lookAt(x, ay, az);
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const handleOut = () => {
    document.body.style.cursor = '';
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <group
      ref={root}
      onPointerOver={onClick ? handleOver : undefined}
      onPointerOut={onClick ? handleOut : undefined}
      onClick={onClick ? handleClick : undefined}
    >
      {onClick ? (
        <mesh position={[0, 0, HIT_BOX_CENTER_Z]}>
          <boxGeometry args={HIT_BOX_SIZE} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
      {/* 機体（機首は +z） */}
      <Voxel x={0} y={-0.07} z={0} w={0.14} h={0.14} d={0.5} color="#f8f8f8" />
      <Voxel x={0} y={0.03} z={0.17} w={0.1} h={0.07} d={0.09} color="#2e86de" />
      <Voxel x={0} y={-0.02} z={0.02} w={0.6} h={0.04} d={0.15} color="#2e86de" />
      <Voxel x={0} y={0.05} z={-0.21} w={0.26} h={0.03} d={0.08} color="#2e86de" />
      <Voxel x={0} y={0.05} z={-0.22} w={0.03} h={0.13} d={0.1} color="#2e86de" />
      {/* 曳航ロープとハートの旗 */}
      <Voxel x={0} y={-0.01} z={-0.42} w={0.016} h={0.016} d={0.34} color="#6b4a2b" />
      <group ref={heartSpin} position={[0, -0.2, -0.72]}>
        {HEART_PATTERN.map((line, row) =>
          line.split('').map((ch, col) =>
            ch === '#' ? (
              <Voxel
                key={`${row}-${col}`}
                x={(col - 3) * HEART_PITCH}
                y={(HEART_PATTERN.length - 1 - row) * HEART_PITCH}
                z={0}
                w={HEART_PITCH * 0.92}
                h={HEART_PITCH * 0.92}
                d={HEART_PITCH * 0.6}
                color={HEART_COLOR}
              />
            ) : null,
          ),
        )}
      </group>
    </group>
  );
};
