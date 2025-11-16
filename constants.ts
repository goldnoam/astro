import { ShipType } from "./types";

export const CELESTIAL_OBJECT_COUNT = 500;
export const STAR_COLORS = ["#FFFFFF", "#FFF8E7", "#D4E8FF", "#FFD4D4"];
export const LASER_COLORS = [
    { name: 'Cyan', color: 'cyan' },
    { name: 'Red', color: 'red' },
    { name: 'Green', color: 'lime' },
];
export const HIGH_SCORE_KEY = 'us-spagettini-high-score';
export const ENEMY_SCORES: Record<ShipType, number> = {
    fighter: 10,
    interceptor: 15,
    cruiser: 25,
    bomber: 50,
    dreadnought: 100
};