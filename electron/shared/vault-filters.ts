/**
 * Filter vocabulary for Vimm's advanced list, extracted from the site's own
 * `/vault/?p=search` form. Region is a REQUIRED query field (numeric id); there is no
 * working "all regions" request, so the UI presents this list and defaults to USA.
 */
import type { SortOrder } from './types.js';

export interface VaultRegion {
  /** Numeric id used as the `region` query param. */
  id: string;
  name: string;
}

/** Common regions first, then the long tail (all values are from Vimm's form). */
export const VAULT_REGIONS: VaultRegion[] = [
  { id: '25', name: 'USA' },
  { id: '8', name: 'Europe' },
  { id: '15', name: 'Japan' },
  { id: '2', name: 'Asia' },
  { id: '3', name: 'Australia' },
  { id: '24', name: 'United Kingdom' },
  { id: '5', name: 'Canada' },
  { id: '4', name: 'Brazil' },
  { id: '16', name: 'Korea' },
  { id: '6', name: 'China' },
  { id: '23', name: 'Taiwan' },
  { id: '13', name: 'Hong Kong' },
  { id: '10', name: 'France' },
  { id: '11', name: 'Germany' },
  { id: '14', name: 'Italy' },
  { id: '21', name: 'Spain' },
  { id: '18', name: 'Netherlands' },
  { id: '22', name: 'Sweden' },
  { id: '19', name: 'Norway' },
  { id: '7', name: 'Denmark' },
  { id: '9', name: 'Finland' },
  { id: '20', name: 'Russia' },
  { id: '28', name: 'Poland' },
  { id: '29', name: 'Portugal' },
  { id: '12', name: 'Greece' },
  { id: '1', name: 'Argentina' },
  { id: '17', name: 'Mexico' },
  { id: '30', name: 'Latin America' },
  { id: '32', name: 'Scandinavia' },
  { id: '31', name: 'Belgium' },
  { id: '33', name: 'Ireland' },
  { id: '34', name: 'Israel' },
  { id: '35', name: 'Austria' },
  { id: '36', name: 'Switzerland' },
  { id: '37', name: 'South Africa' },
  { id: '38', name: 'Croatia' },
  { id: '39', name: 'Turkey' },
  { id: '40', name: 'New Zealand' },
  { id: '41', name: 'United Arab Emirates' },
  { id: '27', name: 'India' },
];

export const DEFAULT_REGION_ID = '25'; // USA

export interface SortOption {
  value: string;
  label: string;
}

/** Sort fields verified to work against `mode=adv` (Title/System/Size confirmed live). */
export const SORT_OPTIONS: SortOption[] = [
  { value: 'Title', label: 'Title' },
  { value: 'Year', label: 'Year' },
  { value: 'Rating', label: 'Rating' },
  { value: 'Size', label: 'Cart Size' },
];

export const DEFAULT_SORT = 'Title';
export const DEFAULT_SORT_ORDER: SortOrder = 'ASC';
