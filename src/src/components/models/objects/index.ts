import { createElement, type ComponentType } from 'react';
import type { EventCategory } from '../../../types/calendar';
import { Airplane } from './Airplane';
import { Airplane2 } from './Airplane2';
import { Airplane3 } from './Airplane3';
import { Church } from './Church';
import { Church2 } from './Church2';
import { Church3 } from './Church3';
import { Gym } from './Gym';
import { Gym2 } from './Gym2';
import { Gym3 } from './Gym3';
import { Hospital } from './Hospital';
import { Hospital2 } from './Hospital2';
import { Hospital3 } from './Hospital3';
import { Office } from './Office';
import { Office2 } from './Office2';
import { Office3 } from './Office3';
import { Restaurant } from './Restaurant';
import { Restaurant2 } from './Restaurant2';
import { Restaurant3 } from './Restaurant3';
import { Salon } from './Salon';
import { Salon2 } from './Salon2';
import { Salon3 } from './Salon3';
import { School } from './School';
import { School2 } from './School2';
import { School3 } from './School3';
import type { ObjectProps } from './types';

/** 屋上スロットの 3×3 ピッチ幅（DayTower 側と合わせる） */
const SLOT = 0.29;

/** 屋上スロット座標 (x, z) から 0〜8 の決定的なインデックスを求める */
const pickVariant = (position: ObjectProps['position']): number => {
  const idx = Math.round(position[0] / SLOT) + 1 + 3 * (Math.round(position[2] / SLOT) + 1);
  return ((idx % 3) + 3) % 3;
};

type Variants = readonly [ComponentType<ObjectProps>, ComponentType<ObjectProps>, ComponentType<ObjectProps>];

/** カテゴリ内の3バリエーションから、位置に応じて決定的に1つを選ぶラッパー */
const makeVariant = (variants: Variants): ComponentType<ObjectProps> => {
  const VariantPicker = ({ position }: ObjectProps) =>
    createElement(variants[pickVariant(position)], { position });
  return VariantPicker;
};

const SalonVariant = makeVariant([Salon, Salon2, Salon3]);
const RestaurantVariant = makeVariant([Restaurant, Restaurant2, Restaurant3]);
const OfficeVariant = makeVariant([Office, Office2, Office3]);
const ChurchVariant = makeVariant([Church, Church2, Church3]);
const HospitalVariant = makeVariant([Hospital, Hospital2, Hospital3]);
const GymVariant = makeVariant([Gym, Gym2, Gym3]);
const AirplaneVariant = makeVariant([Airplane, Airplane2, Airplane3]);
const SchoolVariant = makeVariant([School, School2, School3]);

export const OBJECT_BY_CATEGORY: Record<EventCategory, ComponentType<ObjectProps>> = {
  beauty: SalonVariant,
  restaurant: RestaurantVariant,
  work: OfficeVariant,
  wedding: ChurchVariant,
  hospital: HospitalVariant,
  gym: GymVariant,
  travel: AirplaneVariant,
  school: SchoolVariant,
};
