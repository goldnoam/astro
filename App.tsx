import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CelestialObject, GalaxyInfo, GameState, LaserEffect, ExplosionEffect, ShipType, EnemyShip } from './types';
import { CELESTIAL_OBJECT_COUNT, STAR_COLORS, LASER_COLORS, ENEMY_SCORES, HIGH_SCORE_KEY, HEALTH_REWARD, BOOST_REWARD } from './constants';
import { generateGalaxyInfo } from './services/geminiService';
import Starfield from './components/Starfield';
import { QuantumLeapIcon, TargetIcon, HelpIcon, LaserIcon, EnemyShipIcon, PauseIcon, PlayIcon, SettingsIcon, AsteroidIcon, HealthIcon, UltraBoostIcon, VolumeUpIcon, VolumeMuteIcon } from './components/icons';
import { geoOrthographic, GeoProjection } from 'd3';
import useAudio from './hooks/useAudio';
import useLocalization from './hooks/useLocalization';

const MAX_PLAYER_HEALTH = 100;
const ENEMY_LASER_DAMAGE = 5;

const generateCelestialObjects = (level: number): CelestialObject[] => {
  let shipCount = 0;
  const maxShipsForLevel = Math.floor(Math.random() * 20) + 4; // Random hostiles from 4 to 23

  return Array.from({ length: CELESTIAL_OBJECT_COUNT }, (_, i) => {
    const typeRand = Math.random();
    const common = {
      id: `${typeRand}-${Date.now()}-${i}`,
      coordinates: [(Math.random() - 0.5) * 360, (Math.random() - 0.5) * 180] as [number, number],
    };
    
    if (typeRand < 0.01) { // 1% chance for a heart star
        return { ...common, type: 'heart_star' as const, id: `heart-${common.id}`, size: 1.5 };
    } else if (typeRand < 0.02) { // 1% chance for a boost star
        return { ...common, type: 'boost_star' as const, id: `boost-${common.id}`, size: 1.5 };
    } else if (typeRand < 0.25 && shipCount < maxShipsForLevel) {
      shipCount++;
      const rand = Math.random();
      let shipType: ShipType;
      let size: number;
      let movementPattern: EnemyShip['movementPattern'] = 'static';
      let velocity: [number, number] = [0, 0];
      let flankDirection: EnemyShip['flankDirection'] | undefined = undefined;
      
      const useMk2Ships = level > 1;

      if (rand < 0.4) { 
        shipType = useMk2Ships ? 'fighter-mk2' : 'fighter'; 
        size = Math.random() * 0.5 + 0.8;
        movementPattern = 'strafe';
        velocity = [(Math.random() - 0.5) * 0.4, 0];
      } else if (rand < 0.6) { 
        shipType = useMk2Ships ? 'interceptor-mk2' : 'interceptor'; 
        size = Math.random() * 0.4 + 0.7;
        movementPattern = 'flank';
        flankDirection = Math.random() < 0.5 ? 'cw' : 'ccw';
      } else if (rand < 0.8) { 
        shipType = useMk2Ships ? 'cruiser-mk2' : 'cruiser'; 
        size = Math.random() * 0.6 + 1.2;
      } else if (rand < 0.95) { 
        shipType = useMk2Ships ? 'bomber-mk2' : 'bomber'; 
        size = Math.random() * 0.7 + 1.5;
      } else { 
        shipType = useMk2Ships ? 'dreadnought-mk2' : 'dreadnought'; 
        size = Math.random() * 0.8 + 2.0;
      }

      return { ...common, type: 'ship' as const, id: `ship-${common.id}`, shipType, size, movementPattern, velocity, flankDirection };
    } else if (typeRand < 0.50) {
      return { ...common, type: 'asteroid' as const, id: `asteroid-${common.id}`, size: Math.random() * 1.2 + 0.8 };
    } else {
      return { ...common, type: 'star' as const, id: `star-${common.id}`, size: Math.random() * 1.5 + 0.5, color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)] };
    }
  });
};

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode, actions?: React.ReactNode, closeText: string }> = ({ title, onClose, children, actions, closeText }) => (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-cyan-400 p-6 rounded-lg max-w-md w-full text-white shadow-2xl shadow-cyan-500/30" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-cyan-300 mb-4">{title}</h2>
        {children}
        <div className="mt-6 flex gap-2">
            {actions || <button onClick={onClose} className="w-full bg-cyan-500 text-black font-bold py-2 rounded-lg hover:bg-cyan-400 transition-colors">{closeText}</button>}
        </div>
      </div>
    </div>
);

const App: React.FC = () => {
  const { t, setLanguage, language, languages, dir } = useLocalization();
  const [celestialObjects, setCelestialObjects] = useState<CelestialObject[]>([]);
  const [galaxyInfo, setGalaxyInfo] = useState<GalaxyInfo | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.GENERATING);
  const [laser, setLaser] = useState<LaserEffect | null>(null);
  const [enemyLasers, setEnemyLasers] = useState<LaserEffect[]>([]);
  const [explosions, setExplosions] = useState<ExplosionEffect[]>([]);
  const [laserColorIndex, setLaserColorIndex] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerHealth, setPlayerHealth] = useState(MAX_PLAYER_HEALTH);
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [ultraBoostCount, setUltraBoostCount] = useState(5);
  const [level, setLevel] = useState(1);
  const { playSound, setVolume, volume } = useAudio();
  
  const projectionRef = useRef<GeoProjection>(geoOrthographic());
  const shipPosition = useMemo(() => [window.innerWidth / 2, window.innerHeight], []);
  
  const counts = useMemo(() => ({
      stars: celestialObjects.filter(o => o.type === 'star').length,
      ships: celestialObjects.filter(o => o.type === 'ship').length,
      asteroids: celestialObjects.filter(o => o.type === 'asteroid').length
  }), [celestialObjects]);

  const localizedLaserColors = useMemo(() =>
    LASER_COLORS.map(lc => ({...lc, name: t(lc.nameKey)})),
  [t]);

  const setupNewGalaxy = useCallback(async (levelToGenerate: number, isRestart = false) => {
    setGameState(GameState.GENERATING);
    setCelestialObjects([]);
    setGalaxyInfo(null);
    setEnemyLasers([]);

    if (isRestart) {
      setLevel(1);
      setScore(0);
      setUltraBoostCount(5);
      setShowInstructions(false);
      // Health is only restored at the start of a new game.
      setPlayerHealth(MAX_PLAYER_HEALTH);
    } else {
      setLevel(levelToGenerate);
    }

    const info = await generateGalaxyInfo();
    setGalaxyInfo(info);
    setCelestialObjects(generateCelestialObjects(levelToGenerate));
    setGameState(GameState.IDLE);
  }, []);

  useEffect(() => {
    const storedHighScore = localStorage.getItem(HIGH_SCORE_KEY);
    if (storedHighScore) setHighScore(parseInt(storedHighScore, 10));
    setupNewGalaxy(1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (counts.ships === 0 && gameState === GameState.IDLE && celestialObjects.length > 0 && galaxyInfo !== null) {
      setGameState(GameState.LEAPING);
      playSound('leap');
      setTimeout(() => {
          setupNewGalaxy(level + 1, false);
      }, 2000);
    }
  }, [counts.ships, gameState, celestialObjects.length, galaxyInfo, level, setupNewGalaxy, playSound]);
  
  useEffect(() => {
      if (playerHealth <= 0 && gameState !== GameState.GAME_OVER) {
          setGameState(GameState.GAME_OVER);
          playSound('gameOver');
      }
  }, [playerHealth, gameState, playSound]);

  useEffect(() => {
    if (gameState !== GameState.IDLE) return;

    const intervalId = setInterval(() => {
      const ships = celestialObjects.filter(obj => obj.type === 'ship');
      if (ships.length === 0) return;

      const firingShip = ships[Math.floor(Math.random() * ships.length)];
      const fromPos = projectionRef.current(firingShip.coordinates);
      
      if (!fromPos) return;
      const [cx, cy] = projectionRef.current.translate();
      const scale = projectionRef.current.scale();
      if (Math.sqrt(Math.pow(fromPos[0] - cx, 2) + Math.pow(fromPos[1] - cy, 2)) > scale) return;

      playSound('laserEnemy');
      const id = `enemy-laser-${Date.now()}`;
      const newLaser: LaserEffect = { id, from: fromPos, to: shipPosition, color: 'red' };
      setEnemyLasers(prev => [...prev, newLaser]);

      setTimeout(() => {
          setEnemyLasers(prev => prev.filter(l => l.id !== id));
          if(gameState !== GameState.LEAPING && gameState !== GameState.GENERATING) {
              setPlayerHealth(h => Math.max(0, h - ENEMY_LASER_DAMAGE));
              setIsPlayerHit(true);
              playSound('explosionPlayer');
              setTimeout(() => setIsPlayerHit(false), 300);
          }
      }, 1000);
    }, 2500 - Math.min(1800, counts.ships * 50));

    return () => clearInterval(intervalId);
  }, [gameState, celestialObjects, shipPosition, counts.ships, playSound]);
  
  useEffect(() => {
    let frameId: number;
    const animateShips = () => {
        if (gameState === GameState.IDLE) {
            setCelestialObjects(prev => prev.map(obj => {
                if (obj.type !== 'ship') return obj;

                if (obj.movementPattern === 'strafe') {
                    const [lon, lat] = obj.coordinates;
                    const [dLon, dLat] = obj.velocity;
                    let newLon = lon + dLon;
                    const newLat = lat + dLat;
                    
                    if (newLon > 180) newLon = -180 + (newLon - 180);
                    if (newLon < -180) newLon = 180 + (newLon + 180);
                    
                    let newVel = obj.velocity;
                    if (newLat > 85 || newLat < -85) {
                        newVel = [dLon, -dLat];
                    }
                    return { ...obj, coordinates: [newLon, newLat > 85 ? 85 : newLat < -85 ? -85 : newLat], velocity: newVel };
                } else if (obj.movementPattern === 'flank') {
                    const [lon, lat] = obj.coordinates;
                    const r = Math.sqrt(lon**2 + lat**2);
                    if (r === 0) return { ...obj, coordinates: [0.1, 0] }; // Nudge if at origin
                    
                    const theta = Math.atan2(lat, lon);
                    const angularSpeed = 0.005;
                    
                    const newTheta = theta + (obj.flankDirection === 'cw' ? -angularSpeed : angularSpeed);
                    
                    let newLon = r * Math.cos(newTheta);
                    let newLat = r * Math.sin(newTheta);
                    
                    newLat = Math.max(-90, Math.min(90, newLat));

                    if (newLon > 180) newLon -= 360;
                    if (newLon < -180) newLon += 360;

                    return { ...obj, coordinates: [newLon, newLat] };
                }
                return obj;
            }));
        }
        frameId = requestAnimationFrame(animateShips);
    };
    animateShips();
    return () => cancelAnimationFrame(frameId);
  }, [gameState]);

  const handleQuantumLeap = useCallback(() => {
    if (gameState !== GameState.IDLE) return;
    playSound('uiClick');
    playSound('leap');
    setGameState(GameState.LEAPING);
    setTimeout(async () => {
      setGameState(GameState.GENERATING);
      const info = await generateGalaxyInfo();
      setGalaxyInfo(info);
      setCelestialObjects(generateCelestialObjects(level));
      setGameState(GameState.IDLE);
    }, 1500);
  }, [gameState, level, playSound]);

  const destroyTarget = useCallback((target: CelestialObject, screenPos: [number, number]) => {
      let explosionSizeMultiplier = 1;
      let explosionColors = ['#FFA500', '#FF4500', '#FFFF00', '#FFFFFF'];

      switch (target.type) {
          case 'ship':
              setScore(prevScore => {
                  const points = ENEMY_SCORES[(target as EnemyShip).shipType];
                  const newScore = prevScore + points;
                  if (newScore > highScore) {
                      setHighScore(newScore);
                      localStorage.setItem(HIGH_SCORE_KEY, newScore.toString());
                  }
                  return newScore;
              });
              playSound('explosion');
              break;
          case 'asteroid':
              explosionSizeMultiplier = 0.8;
              explosionColors = ['#A0522D', '#8B4513', '#D2B48C', '#FFFFFF'];
              playSound('explosion');
              break;
          case 'heart_star':
              setPlayerHealth(h => Math.min(MAX_PLAYER_HEALTH, h + HEALTH_REWARD));
              explosionColors = ['#FF1493', '#FFC0CB', '#FFFFFF'];
              explosionSizeMultiplier = 2;
              playSound('powerup');
              break;
          case 'boost_star':
              setUltraBoostCount(c => c + BOOST_REWARD);
              explosionColors = ['#FFD700', '#FFFF00', '#FFFFFF'];
              explosionSizeMultiplier = 2;
              playSound('powerup');
              break;
          default:
              playSound('explosion');
      }

      const fragments = Array.from({ length: 15 + Math.random() * 10 }).map(() => {
          const angle = Math.random() * 2 * Math.PI;
          const distance = Math.random() * 50 + 20;
          return {
              size: (target.size * explosionSizeMultiplier) * (Math.random() * 0.3 + 0.3),
              color: explosionColors[Math.floor(Math.random() * explosionColors.length)],
              delay: Math.random() * 0.1,
              tx: Math.cos(angle) * distance,
              ty: Math.sin(angle) * distance,
              rotation: Math.random() * 360,
          };
      });

      const newExplosion: ExplosionEffect = { 
          id: `explosion-${target.id}`, 
          at: screenPos, 
          fragments,
          flashSize: target.size * explosionSizeMultiplier * 2,
      };
      setExplosions(prev => [...prev, newExplosion]);
      setCelestialObjects(prev => prev.filter(s => s.id !== target.id));

      setTimeout(() => setExplosions(prev => prev.filter(e => e.id !== newExplosion.id)), 800);
  }, [highScore, playSound]);
  
  const fireOnTarget = useCallback((target: CelestialObject, screenPos: [number, number]) => {
      if (gameState !== GameState.IDLE) return;
      playSound('laserPlayer');
      setGameState(GameState.FIRING);
      setLaser({ id: `laser-${target.id}`, from: shipPosition, to: screenPos, color: localizedLaserColors[laserColorIndex].color });

      setTimeout(() => {
        setLaser(null);
        destroyTarget(target, screenPos);
      }, 200);

      setTimeout(() => setGameState(GameState.IDLE), 500);
  }, [gameState, shipPosition, laserColorIndex, destroyTarget, playSound, localizedLaserColors]);
  
  const fireUltraBoost = useCallback(() => {
    if (gameState !== GameState.IDLE || ultraBoostCount <= 0) return;
    playSound('uiClick');

    setUltraBoostCount(c => c - 1);
    setGameState(GameState.FIRING);

    const hostiles = celestialObjects.filter(o => o.type === 'ship');
    const visibleHostiles = hostiles
        .map(h => ({ target: h, screenPos: projectionRef.current(h.coordinates) }))
        .filter(h => {
            if (!h.screenPos) return false;
            const [cx, cy] = projectionRef.current.translate();
            const scale = projectionRef.current.scale();
            return Math.sqrt(Math.pow(h.screenPos[0] - cx, 2) + Math.pow(h.screenPos[1] - cy, 2)) <= scale;
        });

    visibleHostiles.forEach((h, i) => {
        setTimeout(() => {
            playSound('laserPlayer');
            destroyTarget(h.target, h.screenPos as [number, number]);
        }, i * 50);
    });

    setTimeout(() => setGameState(GameState.IDLE), 500 + visibleHostiles.length * 50);
  }, [gameState, ultraBoostCount, celestialObjects, destroyTarget, playSound]);

  const cycleLaserColor = () => {
      playSound('uiClick');
      setLaserColorIndex(prev => (prev + 1) % localizedLaserColors.length);
  }
  const togglePause = () => {
      playSound('uiClick');
      if (gameState === GameState.PAUSED) setGameState(GameState.IDLE);
      else if (gameState === GameState.IDLE) setGameState(GameState.PAUSED);
  };

  const statusMessage = useMemo(() => {
    switch (gameState) {
      case GameState.GENERATING: return t('statusGenerating');
      case GameState.LEAPING: return t('statusLeaping');
      case GameState.FIRING: return t('statusFiring');
      case GameState.PAUSED: return t('statusPaused');
      case GameState.GAME_OVER: return t('statusGameOver');
      case GameState.IDLE: return counts.ships > 0 ? t('statusIdleHostiles') : t('statusIdleClear');
      default: return t('statusStandby');
    }
  }, [gameState, counts.ships, t]);

  return (
    <div dir={dir} className={`h-screen w-screen bg-black overflow-hidden relative font-mono ${isPlayerHit ? 'screen-shake' : ''}`}>
      {gameState === GameState.GAME_OVER && <Modal title={t('missionFailed')} onClose={() => {}} closeText={t('close')} actions={<button onClick={() => { playSound('uiClick'); setupNewGalaxy(1, true); }} className="w-full bg-green-500 text-black font-bold py-2 rounded-lg hover:bg-green-400 transition-colors">{t('restartMission')}</button>}>
          <p>{t('missionFailedBody', { score: score, level: level }).replace('{{score}}', '').replace('{{level}}', '')}
             <strong className="text-green-400">{score}</strong> on level <strong className="text-cyan-400">{level}</strong>.
          </p>
        </Modal>}
      {showInstructions && <Modal title={t('commandersBriefing')} onClose={() => { playSound('uiClick'); setShowInstructions(false); }} closeText={t('close')}>
          <ul className="space-y-3">
            <li><strong className="text-cyan-400">{t('objective')}</strong> {t('objectiveText')}</li>
            <li><strong className="text-cyan-400">{t('controls')}</strong> {t('controlsText')}</li>
            <li><strong className="text-cyan-400">{t('fire')}</strong> {t('fireText')}</li>
            <li><strong className="text-cyan-400">{t('powerups')}</strong> {t('powerupsText')}</li>
            <li><strong className="text-cyan-400">{t('ultraBoost')}</strong> {t('ultraBoostText')}</li>
          </ul>
        </Modal>}
      {showSettings && <Modal title={t('settings')} onClose={() => { playSound('uiClick'); setShowSettings(false); }} closeText={t('close')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyan-300 mb-2">{t('masterVolume')}</label>
            <div className="flex items-center space-x-2">
                <VolumeMuteIcon className="h-6 w-6 text-cyan-400" />
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <VolumeUpIcon className="h-6 w-6 text-cyan-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-cyan-300">{t('language')}</label>
            <select value={language} onChange={e => setLanguage(e.target.value as keyof typeof languages)} className="mt-1 block w-full pl-3 pr-10 py-2 bg-gray-800 border-gray-600 rounded-md focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm">
                {/* FIX: Add explicit type annotation for the destructured map parameter to resolve type inference issue. */}
                {Object.entries(languages).map(([code, {name}]: [string, {name: string}]) => 
                    <option key={code} value={code}>{name}</option>
                )}
            </select>
          </div>
        </div>
        </Modal>}
      
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 via-black to-black" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
      {isPlayerHit && <div className="absolute inset-0 bg-red-800/80 pointer-events-none z-50 player-hit-flash" />}
      
      <Starfield celestialObjects={celestialObjects} onTargetClick={fireOnTarget} isLeaping={gameState === GameState.LEAPING} isPaused={gameState === GameState.PAUSED} projection={projectionRef.current}/>

      <svg width="100%" height="100%" className="absolute inset-0 pointer-events-none">
        {laser && <line x1={laser.from[0]} y1={laser.from[1]} x2={laser.to[0]} y2={laser.to[1]} stroke={laser.color} strokeWidth="3" className="laser-beam" strokeLinecap="round" />}
        {enemyLasers.map(l => <line key={l.id} x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} stroke={l.color} strokeWidth="2" strokeDasharray="5 5" className="laser-beam" />)}
        {explosions.map(exp => 
          <g key={exp.id} transform={`translate(${exp.at[0]}, ${exp.at[1]})`}>
            <circle cx="0" cy="0" r={exp.flashSize} fill="white" className="explosion-flash" />
            {exp.fragments.map((frag, i) => 
              <line 
                key={i} 
                x1={0} y1={0} x2={frag.size} y2={0} 
                stroke={frag.color} 
                strokeWidth="2" 
                className="explosion"
                style={{
                  '--tx': `${frag.tx}px`,
                  '--ty': `${frag.ty}px`,
                  transform: `rotate(${frag.rotation}deg)`,
                  animationDelay: `${frag.delay}s`,
                } as React.CSSProperties}
              />
            )}
          </g>
        )}
      </svg>
      
      <header className="absolute top-0 left-0 p-4 md:p-6 text-cyan-300 pointer-events-none w-full flex justify-between items-start">
        <div><h1 className="text-xl md:text-3xl font-bold tracking-widest uppercase">{t('shipName')}</h1><p className="text-sm md:text-base text-white/80">{t('level', {level})}</p></div>
        <div className='text-right'><p className="text-lg md:text-xl font-semibold">{galaxyInfo ? galaxyInfo.name : t('scanning')}</p><p className="text-xs md:text-sm max-w-[150px] sm:max-w-xs text-white/70 italic">{galaxyInfo ? galaxyInfo.description : ''}</p></div>
      </header>

      <footer className="absolute bottom-0 left-0 w-full p-4 flex flex-col items-center">
        <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-3 flex flex-col items-center justify-center space-y-3 shadow-2xl shadow-cyan-500/20 w-full max-w-3xl">
          <div className="flex items-start justify-around w-full text-center">
             <div className="flex flex-col items-center flex-1 min-w-0 px-1"><TargetIcon className="h-5 w-5 text-cyan-300 mb-1"/><span className="text-xs sm:text-sm font-bold">{counts.stars}</span><span className="text-[9px] sm:text-[10px] uppercase text-cyan-400/80">{t('stars')}</span></div>
             <div className="flex flex-col items-center flex-1 min-w-0 px-1"><AsteroidIcon className="h-5 w-5 text-gray-400 mb-1"/><span className="text-xs sm:text-sm font-bold">{counts.asteroids}</span><span className="text-[9px] sm:text-[10px] uppercase text-gray-400/80">{t('asteroids')}</span></div>
             <div className="flex flex-col items-center flex-1 min-w-0 px-1"><EnemyShipIcon className="h-5 w-5 text-red-400 mb-1"/><span className="text-xs sm:text-sm font-bold">{counts.ships}</span><span className="text-[9px] sm:text-[10px] uppercase text-red-400/80">{t('hostiles')}</span></div>
             <div className="flex flex-col items-center flex-1 min-w-0 px-1"><span className="text-xs sm:text-sm font-bold">{score}</span><span className="text-[9px] sm:text-[10px] uppercase text-green-400/80">{t('score')}</span></div>
             <div className="flex flex-col items-center flex-1 min-w-0 px-1"><span className="text-xs sm:text-sm font-bold">{highScore}</span><span className="text-[9px] sm:text-[10px] uppercase text-yellow-400/80">{t('highScore')}</span></div>
          </div>
          <div className="w-full h-[1px] bg-cyan-500/30"></div>
          <div className="flex items-center justify-center flex-wrap gap-x-2 md:gap-x-4 gap-y-2 w-full">
            <button onClick={handleQuantumLeap} disabled={gameState !== GameState.IDLE} className="px-3 py-2 bg-cyan-500 text-black font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 shadow-lg shadow-cyan-500/50 text-sm"><QuantumLeapIcon className="h-5 w-5"/><span>{t('leap')}</span></button>
            <button onClick={fireUltraBoost} disabled={gameState !== GameState.IDLE || ultraBoostCount <= 0} className="px-3 py-2 bg-yellow-500 text-black font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 shadow-lg shadow-yellow-500/50 text-sm"><UltraBoostIcon className="h-5 w-5"/><span>{t('boost', {count: ultraBoostCount})}</span></button>
            <button onClick={cycleLaserColor} disabled={gameState !== GameState.IDLE} style={{ color: localizedLaserColors[laserColorIndex].color }} className="px-3 py-2 bg-gray-800 border border-gray-600 font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 text-sm"><LaserIcon className="h-5 w-5"/><span className="hidden sm:inline">{localizedLaserColors[laserColorIndex].name}</span></button>
            <button onClick={togglePause} disabled={gameState !== GameState.IDLE && gameState !== GameState.PAUSED} className="px-3 py-2 bg-gray-800 border border-gray-600 font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 text-white"><span className="sr-only">{t('pauseResume')}</span>{gameState === GameState.PAUSED ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}</button>
            <button onClick={() => { playSound('uiClick'); setShowSettings(true); }} className="px-3 py-2 bg-gray-800 border border-gray-600 font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 text-white"><span className="sr-only">{t('srSettings')}</span><SettingsIcon className="h-5 w-5" /></button>
            <button onClick={() => { playSound('uiClick'); setShowInstructions(true); }} className="px-3 py-2 bg-gray-800 border border-gray-600 font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 text-white"><span className="sr-only">{t('help')}</span><HelpIcon className="h-5 w-5" /></button>
          </div>
           <div className="w-full h-[1px] bg-cyan-500/30"></div>
           <div className="flex flex-col md:flex-row items-center justify-between w-full space-y-2 md:space-y-0 md:space-x-4">
              <div className="flex items-center space-x-2 text-green-400 w-full md:w-auto"><HealthIcon className="h-5 w-5" /><div className="flex-1 h-4 bg-gray-800 border border-green-700 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300" style={{width: `${(playerHealth / MAX_PLAYER_HEALTH) * 100}%`}}></div></div></div>
              <div className="text-center w-full md:w-36 flex-shrink-0"><p className="text-xs text-white truncate">{statusMessage}</p><div className="h-1 w-full bg-cyan-900/50 mt-1 rounded-full overflow-hidden"><div className={`h-1 bg-cyan-400 transition-all duration-300 ${gameState === GameState.IDLE || gameState === GameState.PAUSED ? 'w-full' : 'w-0'}`}></div></div><span className="text-[10px] uppercase text-cyan-400/80">{t('systemStatus')}</span></div>
           </div>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">
            {t('copyright')} <a href="mailto:gold.noam@gmail.com" className="hover:text-cyan-400 transition-colors">{t('sendFeedback')}</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
