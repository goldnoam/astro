import { ShipType } from "./types";

export const CELESTIAL_OBJECT_COUNT = 500;
export const STAR_COLORS = ["#FFFFFF", "#FFF8E7", "#D4E8FF", "#FFD4D4"];
export const LASER_COLORS = [
    { nameKey: 'laserCyan', color: 'cyan' },
    { nameKey: 'laserRed', color: 'red' },
    { nameKey: 'laserGreen', color: 'lime' },
];
export const HIGH_SCORE_KEY = 'us-spagettini-high-score';
export const AUDIO_VOLUME_KEY = 'us-spagettini-volume';
export const LANGUAGE_KEY = 'us-spagettini-language';
export const HEALTH_REWARD = 10;
export const BOOST_REWARD = 1;
export const ENEMY_SCORES: Record<ShipType, number> = {
    fighter: 10,
    interceptor: 15,
    cruiser: 25,
    bomber: 50,
    dreadnought: 100,
    'fighter-mk2': 20,
    'interceptor-mk2': 30,
    'cruiser-mk2': 50,
    'bomber-mk2': 100,
    'dreadnought-mk2': 200,
};