import { Voxel as VoxelMesh } from '../../components/models/Voxel';
import { SEA_Y } from '../../lib/camera';

const Voxel = (props: Parameters<typeof VoxelMesh>[0]) => <VoxelMesh {...props} pick={false} />;

const OAK = '#c4a574';
const OAK_DARK = '#6b3f24';
const STONE = '#9aa3ad';
const ROOF = '#3d5c48';
const ROOF_RIDGE = '#2a4033';
const PAGE = '#fff6dc';
const INK = '#1b2a41';
const LANTERN = '#f4d35e';
const GLASS = '#bde0fe';
const BOOK_COLORS = ['#c9403a', '#2e6fd6', '#e8c547', '#3a6b4a', '#7b4ea3', '#d9782a'] as const;

/** 木枠の中に並んだ本。色の背表紙が「本棚」だと一目で分かる */
const BookShelf = ({ x, y, z, width }: { x: number; y: number; z: number; width: number }) => {
  const n = 8;
  const inner = width - 0.16;
  return (
    <group>
      <Voxel x={x} y={y} z={z} w={width} h={0.46} d={0.28} color={OAK_DARK} />
      <Voxel x={x} y={y + 0.06} z={z + 0.02} w={inner} h={0.34} d={0.18} color={OAK} />
      {Array.from({ length: n }, (_, i) => (
        <Voxel
          key={i}
          x={x - inner / 2 + 0.08 + (i * (inner - 0.16)) / (n - 1)}
          y={y + 0.08}
          z={z + 0.06}
          w={0.1}
          h={0.22 + (i % 3) * 0.05}
          d={0.14}
          color={BOOK_COLORS[i % BOOK_COLORS.length]}
        />
      ))}
    </group>
  );
};

/** 海に立てた大きな本。表紙と小口で本だと分かる */
const StandingBook = ({
  x,
  z,
  yaw,
  color,
  h,
}: {
  x: number;
  z: number;
  yaw: number;
  color: string;
  h: number;
}) => (
  <group position={[x, SEA_Y, z]} rotation={[0, yaw, 0]}>
    <Voxel x={0} y={0} z={0} w={0.95} h={h} d={0.28} color={color} />
    <Voxel x={0} y={0.1} z={0.1} w={0.78} h={h - 0.2} d={0.14} color={PAGE} />
    <Voxel x={0} y={h * 0.4} z={0.18} w={0.5} h={0.08} d={0.05} color={INK} />
    <Voxel x={0} y={h * 0.54} z={0.18} w={0.38} h={0.05} d={0.05} color={INK} />
  </group>
);

/** 開いた本を置いた読書台 */
const Lectern = ({ x, z }: { x: number; z: number }) => (
  <group position={[x, SEA_Y, z]}>
    <Voxel x={0} y={0} z={0} w={0.7} h={0.18} d={0.7} color={STONE} />
    <Voxel x={0} y={0.18} z={0} w={0.22} h={0.7} d={0.22} color={OAK_DARK} />
    <Voxel x={0} y={0.88} z={0} w={0.85} h={0.1} d={0.55} color={OAK} />
    <Voxel x={-0.2} y={0.98} z={0.02} w={0.36} h={0.05} d={0.42} color={PAGE} />
    <Voxel x={0.2} y={0.98} z={0.02} w={0.36} h={0.05} d={0.42} color={PAGE} />
    <Voxel x={0} y={0.98} z={0.02} w={0.08} h={0.08} d={0.4} color={OAK_DARK} />
    <Voxel x={-0.18} y={1.03} z={0.02} w={0.22} h={0.02} d={0.02} color={INK} />
    <Voxel x={0.18} y={1.03} z={0.02} w={0.2} h={0.02} d={0.02} color={INK} />
  </group>
);

const LanternPost = ({ x, z }: { x: number; z: number }) => (
  <group position={[x, SEA_Y, z]}>
    <Voxel x={0} y={0} z={0} w={0.22} h={0.12} d={0.22} color={STONE} />
    <Voxel x={0} y={0.12} z={0} w={0.1} h={1.15} d={0.1} color={OAK_DARK} />
    <Voxel x={0} y={1.27} z={0} w={0.22} h={0.08} d={0.22} color={OAK_DARK} />
    <Voxel x={0} y={1.35} z={0} w={0.18} h={0.22} d={0.18} color={LANTERN} />
    <Voxel x={0} y={1.57} z={0} w={0.2} h={0.06} d={0.2} color={OAK_DARK} />
  </group>
);

/** 島の奥の海に置く図書館。屋根は建物の上だけ。島の予定は覆わない */
const LibraryHall = () => (
  <group position={[0, SEA_Y, -6.55]}>
    <Voxel x={0} y={0} z={0} w={6.4} h={0.28} d={1.9} color={STONE} />
    <Voxel x={0} y={0.28} z={0} w={6.1} h={2.35} d={1.55} color={OAK} />
    <Voxel x={0} y={0.28} z={0.72} w={1.05} h={1.55} d={0.12} color={OAK_DARK} />
    <Voxel x={0} y={1.05} z={0.78} w={0.42} h={0.38} d={0.08} color={GLASS} />

    <BookShelf x={-2.05} y={0.42} z={0.82} width={1.7} />
    <BookShelf x={-2.05} y={1.05} z={0.82} width={1.7} />
    <BookShelf x={-2.05} y={1.68} z={0.82} width={1.7} />
    <BookShelf x={2.05} y={0.42} z={0.82} width={1.7} />
    <BookShelf x={2.05} y={1.05} z={0.82} width={1.7} />
    <BookShelf x={2.05} y={1.68} z={0.82} width={1.7} />

    <Voxel x={-3.15} y={0} z={0} w={1.15} h={3.35} d={1.7} color={OAK} />
    <Voxel x={3.15} y={0} z={0} w={1.15} h={3.35} d={1.7} color={OAK} />
    <BookShelf x={-3.15} y={0.5} z={0.9} width={0.95} />
    <BookShelf x={-3.15} y={1.2} z={0.9} width={0.95} />
    <BookShelf x={-3.15} y={1.9} z={0.9} width={0.95} />
    <BookShelf x={3.15} y={0.5} z={0.9} width={0.95} />
    <BookShelf x={3.15} y={1.2} z={0.9} width={0.95} />
    <BookShelf x={3.15} y={1.9} z={0.9} width={0.95} />
    <Voxel x={-3.15} y={2.55} z={0.9} w={0.38} h={0.42} d={0.08} color={GLASS} />
    <Voxel x={3.15} y={2.55} z={0.9} w={0.38} h={0.42} d={0.08} color={GLASS} />

    <Voxel x={0} y={2.55} z={0} w={6.5} h={0.22} d={2.05} color={OAK_DARK} />
    <Voxel x={0} y={2.77} z={0} w={5.6} h={0.42} d={1.55} color={ROOF} />
    <Voxel x={0} y={3.19} z={0} w={4.2} h={0.38} d={1.15} color={ROOF} />
    <Voxel x={0} y={3.57} z={0} w={2.4} h={0.32} d={0.7} color={ROOF_RIDGE} />
    <Voxel x={-3.15} y={3.35} z={0} w={1.35} h={0.28} d={1.85} color={ROOF} />
    <Voxel x={3.15} y={3.35} z={0} w={1.35} h={0.28} d={1.85} color={ROOF} />
    <Voxel x={-3.15} y={3.63} z={0} w={0.7} h={0.22} d={0.7} color={ROOF_RIDGE} />
    <Voxel x={3.15} y={3.63} z={0} w={0.7} h={0.22} d={0.7} color={ROOF_RIDGE} />
    {[-2.4, -1.2, 0, 1.2, 2.4].flatMap((x, xi) =>
      [-0.4, 0.4].map((z, zi) => (
        <Voxel
          key={`${x}:${z}`}
          x={x}
          y={3.89}
          z={z}
          w={0.85}
          h={0.2}
          d={0.48}
          color={BOOK_COLORS[(xi + zi * 3) % BOOK_COLORS.length]}
        />
      )),
    )}
  </group>
);

/**
 * 勉強時間の達成エフェクト。島の予定は隠さず、海側に本棚と大きな本を置く。
 * すべて既存の Voxel（直方体）で、マイクラの本棚と同じ読み方。
 */
export const StudyEffect = () => (
  <group>
    <LibraryHall />
    <StandingBook x={-5.85} z={-0.6} yaw={0.45} color="#c9403a" h={2.55} />
    <StandingBook x={-5.4} z={0.35} yaw={0.18} color="#2e6fd6" h={2.2} />
    <StandingBook x={-6.15} z={0.95} yaw={0.7} color="#e8c547" h={1.85} />
    <StandingBook x={5.9} z={-1.05} yaw={-0.55} color="#3a6b4a" h={2.45} />
    <StandingBook x={5.45} z={-0.2} yaw={-0.25} color="#7b4ea3" h={2.1} />
    <StandingBook x={6.2} z={0.65} yaw={-0.8} color="#d9782a" h={1.75} />
    <Lectern x={-5.45} z={2.7} />
    <Lectern x={5.55} z={2.5} />
    <LanternPost x={-4.75} z={-4.55} />
    <LanternPost x={4.75} z={-4.55} />
    <LanternPost x={-5.15} z={3.25} />
    <LanternPost x={5.25} z={3.15} />
  </group>
);
