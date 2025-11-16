export interface Star {
  type: 'star';
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  size: number;
  color: string;
}

export type ShipType = 'fighter' | 'interceptor' | 'cruiser' | 'bomber' | 'dreadnought';

export interface EnemyShip {
  type: 'ship';
  id: string;
  coordinates: [number, number];
  size: number;
  shipType: ShipType;
}

export interface Asteroid {
  type: 'asteroid';
  id: string;
  coordinates: [number, number];
  size: number;
}

export type CelestialObject = Star | EnemyShip | Asteroid;


export interface GalaxyInfo {
  name: string;
  description: string;
}

export enum GameState {
  IDLE = 'IDLE',
  FIRING = 'FIRING',
  LEAPING = 'LEAPING',
  GENERATING = 'GENERATING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
  GAME_OVER = 'GAME_OVER',
}

export interface LaserEffect {
  id: string;
  from: [number, number];
  to: [number, number];
  color: string;
}

export interface ExplosionEffect {
  id: string;
  at: [number, number];
  fragments: { size: number; color: string; delay: number }[];
}