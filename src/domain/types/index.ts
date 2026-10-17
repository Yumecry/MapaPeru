export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type VerifyStatus = 'pendiente' | 'verificado' | 'rechazado';

export interface HotspotProperties {
  id: string;
  latitude: number;
  longitude: number;
  frp: number;
  confidence: 'n' | 'h';
  source: 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';
  acquisitionDate: string;
  brightness: number;
  scan: number;
  track: number;
  satellite: 'NOAA-20' | 'NOAA-21';
}

export type UrgencyLevel = 'critico' | 'moderado' | 'cubierto';

export type SupplyCategory = 'agua' | 'colirios' | 'herramientas' | 'veterinaria';

export interface LogisticsContact {
  fullName: string;
  phone: string;
  region: string;
  district: string;
}
