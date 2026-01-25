export interface LPGStation {
  name: string;
  city_he: string;
  city_en: string;
  address: string;
  brand: string;
  price_ils?: number;
  last_updated?: string;
  status?: string;
  on_highway?: boolean;
  source_refs?: string;
  lat: number;
  lng: number;
  comment?: string;
}