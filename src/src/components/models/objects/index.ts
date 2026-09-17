import type { ComponentType } from 'react';
import type { EventCategory } from '../../../types/calendar';
import { Airplane } from './Airplane';
import { Church } from './Church';
import { Gym } from './Gym';
import { Hospital } from './Hospital';
import { Office } from './Office';
import { Restaurant } from './Restaurant';
import { Salon } from './Salon';
import { School } from './School';
import type { ObjectProps } from './types';

export const OBJECT_BY_CATEGORY: Record<EventCategory, ComponentType<ObjectProps>> = {
  beauty: Salon,
  restaurant: Restaurant,
  work: Office,
  wedding: Church,
  hospital: Hospital,
  gym: Gym,
  travel: Airplane,
  school: School,
};
