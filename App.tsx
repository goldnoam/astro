import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CelestialObject, GalaxyInfo, GameState, LaserEffect, ExplosionEffect, ShipType, EnemyShip } from './types';
import { CELESTIAL_OBJECT_COUNT, STAR_COLORS, LASER_COLORS, ENEMY_SCORES, HIGH_SCORE_KEY } from './constants';
import { generateGalaxyInfo } from './services/geminiService';
import Starfield from './components/Starfield';
import { QuantumLeapIcon, TargetIcon, HelpIcon, LaserIcon, EnemyShipIcon, PauseIcon, PlayIcon, SettingsIcon, AsteroidIcon, HealthIcon, AutoAimIcon, UltraBoostIcon } from './components/icons';
import { geoOrthographic, GeoProjection } from 'd3';

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

    if (typeRand < 0.25 && shipCount < maxShipsForLevel) {
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

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode, actions?: React.ReactNode }> = ({ title, onClose, children, actions }) => (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-cyan-400 p-6 rounded-lg max-w-md w-full text-white shadow-2xl shadow-cyan-500/30" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-cyan-300 mb-4">{title}</h2>
        {children}
        <div className="mt-6 flex gap-2">
            {actions || <button onClick={onClose} className="w-full bg-cyan-500 text-black font-bold py-2 rounded-lg hover:bg-cyan-400 transition-colors">Close</button>}
        </div>
      </div>
    </div>
);

const App: React.FC = () => {
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
  const [isAutoAimActive, setIsAutoAimActive] = useState(false);
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [ultraBoostCount, setUltraBoostCount] = useState(5);
  const [level, setLevel] = useState(1);
  
  const projectionRef = useRef<GeoProjection>(geoOrthographic());
  const shipPosition = useMemo(() => [window.innerWidth / 2, window.innerHeight], []);
  
  const counts = useMemo(() => ({
      stars: celestialObjects.filter(o => o.type === 'star').length,
      ships: celestialObjects.filter(o => o.type === 'ship').length,
      asteroids: celestialObjects.filter(o => o.type === 'asteroid').length
  }), [celestialObjects]);

  const setupNewGalaxy = useCallback(async (levelToGenerate: number, isRestart = false) => {
    setGameState(GameState.GENERATING);
    setCelestialObjects([]);
    setGalaxyInfo(null);
    setEnemyLasers([]);

    if (isRestart) {
      setLevel(1);
      setScore(0);
      setPlayerHealth(MAX_PLAYER_HEALTH);
      setIsAutoAimActive(false);
      setUltraBoostCount(5);
      setShowInstructions(false);
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
      setTimeout(() => {
          setupNewGalaxy(level + 1, false);
      }, 2000);
    }
  }, [counts.ships, gameState, celestialObjects.length, galaxyInfo, level, setupNewGalaxy]);
  
  useEffect(() => {
      if (playerHealth <= 0 && gameState !== GameState.GAME_OVER) {
          setGameState(GameState.GAME_OVER);
      }
  }, [playerHealth, gameState]);

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

      const id = `enemy-laser-${Date.now()}`;
      const newLaser: LaserEffect = { id, from: fromPos, to: shipPosition, color: 'red' };
      setEnemyLasers(prev => [...prev, newLaser]);

      setTimeout(() => {
          setEnemyLasers(prev => prev.filter(l => l.id !== id));
          if(gameState !== GameState.LEAPING && gameState !== GameState.GENERATING) {
              setPlayerHealth(h => Math.max(0, h - ENEMY_LASER_DAMAGE));
              setIsPlayerHit(true);
              setTimeout(() => setIsPlayerHit(false), 300);
          }
      }, 1000);
    }, 2500 - Math.min(1800, counts.ships * 50));

    return () => clearInterval(intervalId);
  }, [gameState, celestialObjects, shipPosition, counts.ships]);
  
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
                    
                    // CRITICAL FIX: This cartesian-on-polar math can produce invalid latitudes.
                    // Clamp the latitude to the valid [-90, 90] range to prevent crashes.
                    newLat = Math.max(-90, Math.min(90, newLat));

                    // Wrap longitude to keep it in [-180, 180]
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

  const handleQuantumLeap = useCallback(async () => {
    if (gameState !== GameState.IDLE) return;
    setGameState(GameState.LEAPING);
    setTimeout(async () => {
      setGameState(GameState.GENERATING);
      const info = await generateGalaxyInfo();
      setGalaxyInfo(info);
      setCelestialObjects(generateCelestialObjects(level));
      setGameState(GameState.IDLE);
    }, 1500);
  }, [gameState, level]);

  const destroyTarget = useCallback((target: CelestialObject, screenPos: [number, number]) => {
      const getExplosionSizeMultiplier = () => {
          if (target.type === 'star') return 1; if (target.type === 'asteroid') return 0.8;
          switch (target.shipType) {
            case 'fighter': return 2; case 'interceptor': return 1.8; case 'cruiser': return 4;
            case 'bomber': return 6; case 'dreadnought': return 8;
            case 'fighter-mk2': return 2.5; case 'interceptor-mk2': return 2.2; case 'cruiser-mk2': return 5;
            case 'bomber-mk2': return 7; case 'dreadnought-mk2': return 10;
            default: return 1;
          }
        };

      if (target.type === 'ship') {
          setScore(prevScore => {
              const points = ENEMY_SCORES[(target as EnemyShip).shipType];
              const newScore = prevScore + points;
              if (newScore > highScore) {
                  setHighScore(newScore);
                  localStorage.setItem(HIGH_SCORE_KEY, newScore.toString());
              }
              return newScore;
          });
      }

      const fragments = Array.from({ length: 15 + Math.random() * 10 }).map(() => {
          const angle = Math.random() * 2 * Math.PI;
          const distance = Math.random() * 50 + 20;
          return {
              size: (target.size * getExplosionSizeMultiplier()) * (Math.random() * 0.3 + 0.3),
              color: ['#FFA500', '#FF4500', '#FFFF00', '#FFFFFF'][Math.floor(Math.random() * 4)],
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
          flashSize: target.size * getExplosionSizeMultiplier() * 2,
      };
      setExplosions(prev => [...prev, newExplosion]);
      setCelestialObjects(prev => prev.filter(s => s.id !== target.id));

      setTimeout(() => setExplosions(prev => prev.filter(e => e.id !== newExplosion.id)), 800);
  }, [highScore]);
  
  const fireOnTarget = useCallback((target: CelestialObject, screenPos: [number, number]) => {
      if (gameState !== GameState.IDLE) return;
      setGameState(GameState.FIRING);
      setLaser({ id: `laser-${target.id}`, from: shipPosition, to: screenPos, color: LASER_COLORS[laserColorIndex].color });

      setTimeout(() => {
        setLaser(null);
        destroyTarget(target, screenPos);
      }, 200);

      setTimeout(() => setGameState(GameState.IDLE), 500);
  }, [gameState, shipPosition, laserColorIndex, destroyTarget]);

  const handleTargetClick = (target: CelestialObject, screenPos: [number, number]) => {
    if (isAutoAimActive) return;
    fireOnTarget(target, screenPos);
  };
  
  const handleAutoFire = useCallback(() => {
    const hostiles = celestialObjects.filter(o => o.type === 'ship');
    const visibleHostiles = hostiles
        .map(h => ({ target: h, screenPos: projectionRef.current(h.coordinates) }))
        .filter(h => {
            if (!h.screenPos) return false;
            const [cx, cy] = projectionRef.current.translate();
            const scale = projectionRef.current.scale();
            return Math.sqrt(Math.pow(h.screenPos[0] - cx, 2) + Math.pow(h.screenPos[1] - cy, 2)) <= scale;
        });

    if (visibleHostiles.length === 0) return;

    let closestTarget = visibleHostiles[0];
    let minDistance = Infinity;
    visibleHostiles.forEach(h => {
        const dist = Math.sqrt(Math.pow(h.screenPos[0] - shipPosition[0], 2) + Math.pow(h.screenPos[1] - shipPosition[1], 2));
        if (dist < minDistance) { minDistance = dist; closestTarget = h; }
    });

    fireOnTarget(closestTarget.target, closestTarget.screenPos as [number, number]);
  }, [celestialObjects, fireOnTarget, shipPosition]);

  useEffect(() => {
      if (!isAutoAimActive || gameState !== GameState.IDLE) return;
      const autoFireInterval = setInterval(handleAutoFire, 750);
      return () => clearInterval(autoFireInterval);
  }, [isAutoAimActive, gameState, handleAutoFire]);
  
  const fireUltraBoost = useCallback(() => {
    if (gameState !== GameState.IDLE || ultraBoostCount <= 0) return;

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
        setTimeout(() => destroyTarget(h.target, h.screenPos as [number, number]), i * 50);
    });

    setTimeout(() => setGameState(GameState.IDLE), 500 + visibleHostiles.length * 50);
  }, [gameState, ultraBoostCount, celestialObjects, destroyTarget]);

  const cycleLaserColor = () => setLaserColorIndex(prev => (prev + 1) % LASER_COLORS.length);
  const togglePause = () => {
      if (gameState === GameState.PAUSED) setGameState(GameState.IDLE);
      else if (gameState === GameState.IDLE) setGameState(GameState.PAUSED);
  };

  const statusMessage = useMemo(() => {
    switch (gameState) {
      case GameState.GENERATING: return 'Generating new galaxy...';
      case GameState.LEAPING: return 'Quantum Leap in progress...';
      case GameState.FIRING: return 'Weapons active!';
      case GameState.PAUSED: return 'System Paused.';
      case GameState.GAME_OVER: return 'MISSION FAILED.';
      case GameState.IDLE: return counts.ships > 0 ? 'Awaiting command.' : 'Sector clear! Advancing...';
      default: return 'Standby.';
    }
  }, [gameState, counts.ships]);

  return (
    <div className={`h-screen w-screen bg-black overflow-hidden relative font-mono ${isPlayerHit ? 'screen-shake' : ''}`}>
      {gameState === GameState.GAME_OVER && <Modal title="Mission Failed" onClose={() => {}} actions={<button onClick={() => setupNewGalaxy(1, true)} className="w-full bg-green-500 text-black font-bold py-2 rounded-lg hover:bg-green-400 transition-colors">Restart Mission</button>}>
          <p>Your ship has been destroyed. Your final score was <strong className="text-green-400">{score}</strong> on level <strong className="text-cyan-400">{level}</strong>.</p>
        </Modal>}
      {showInstructions && <Modal title="Commander's Briefing" onClose={() => setShowInstructions(false)}>
          <ul className="space-y-3">
            <li><strong className="text-cyan-400">Objective:</strong> Clear all hostile ships to advance to the next level.</li>
            <li><strong className="text-cyan-400">Rotate/Zoom:</strong> Click & drag / mouse wheel.</li>
            <li><strong className="text-cyan-400">Fire:</strong> Click on a target. (Disabled when Auto-Aim is on).</li>
            <li><strong className="text-cyan-400">Ultra-Boost:</strong> Destroys all visible hostiles. Limited charges.</li>
          </ul>
        </Modal>}
      {showSettings && <Modal title="Settings" onClose={() => setShowSettings(false)}>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-cyan-300">Language</label>
          <select className="mt-1 block w-full pl-3 pr-10 py-2 bg-gray-800 border-gray-600 rounded-md focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm">
            <option>English</option><option disabled>Español (Coming Soon)</option>
          </select>
        </div>
        </Modal>}
      
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 via-black to-black" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
      {isPlayerHit && <div className="absolute inset-0 bg-red-800/80 pointer-events-none z-50 player-hit-flash" />}
      
      <Starfield celestialObjects={celestialObjects} onTargetClick={handleTargetClick} isLeaping={gameState === GameState.LEAPING} isPaused={gameState === GameState.PAUSED} projection={projectionRef.current}/>

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
        <div><h1 className="text-xl md:text-3xl font-bold tracking-widest uppercase">U.S. Spagettini</h1><p className="text-sm md:text-base text-white/80">Level: {level}</p></div>
        <div className='text-right'><p className="text-lg md:text-xl font-semibold">{galaxyInfo ? galaxyInfo.name : 'Scanning...'}</p><p className="text-xs md:text-sm max-w-xs text-white/70 italic">{galaxyInfo ? galaxyInfo.description : ''}</p></div>
      </header>
      
      <div className="absolute top-4 right-4 md:top-6 md:right-6 flex space-x-2 z-20">
        <button onClick={() => setShowInstructions(true)} className="text-cyan-400 hover:text-white transition-colors" aria-label="Show instructions"><HelpIcon className="h-8 w-8"/></button>
        <button onClick={() => setShowSettings(true)} className="text-cyan-400 hover:text-white transition-colors" aria-label="Show settings"><SettingsIcon className="h-8 w-8"/></button>
      </div>

      <footer className="absolute bottom-0 left-0 w-full p-4 flex flex-col items-center">
        <div className="bg-black/50 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-3 flex flex-col items-center justify-center space-y-3 shadow-2xl shadow-cyan-500/20 w-full max-w-3xl">
          <div className="flex items-center justify-around w-full text-center">
             <div className="flex flex-col items-center w-20"><TargetIcon className="h-5 w-5 text-cyan-300 mb-1"/><span className="text-sm font-bold">{counts.stars}</span><span className="text-[10px] uppercase text-cyan-400/80">Stars</span></div>
             <div className="flex flex-col items-center w-20"><AsteroidIcon className="h-5 w-5 text-gray-400 mb-1"/><span className="text-sm font-bold">{counts.asteroids}</span><span className="text-[10px] uppercase text-gray-400/80">Asteroids</span></div>
             <div className="flex flex-col items-center w-20"><EnemyShipIcon className="h-5 w-5 text-red-400 mb-1"/><span className="text-sm font-bold">{counts.ships}</span><span className="text-[10px] uppercase text-red-400/80">Hostiles</span></div>
             <div className="flex flex-col items-center w-24"><span className="text-sm font-bold">{score}</span><span className="text-[10px] uppercase text-green-400/80">Score</span></div>
             <div className="flex flex-col items-center w-24"><span className="text-sm font-bold">{highScore}</span><span className="text-[10px] uppercase text-yellow-400/80">High Score</span></div>
          </div>
          <div className="w-full h-[1px] bg-cyan-500/30"></div>
          <div className="flex items-center justify-center space-x-2 md:space-x-4 w-full">
            <button onClick={handleQuantumLeap} disabled={gameState !== GameState.IDLE} className="px-3 py-2 bg-cyan-500 text-black font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 shadow-lg shadow-cyan-500/50 text-sm"><QuantumLeapIcon className="h-5 w-5"/><span>Leap</span></button>
            <button onClick={fireUltraBoost} disabled={gameState !== GameState.IDLE || ultraBoostCount <= 0} className="px-3 py-2 bg-yellow-500 text-black font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 shadow-lg shadow-yellow-500/50 text-sm"><UltraBoostIcon className="h-5 w-5"/><span>Boost ({ultraBoostCount})</span></button>
            <button onClick={cycleLaserColor} disabled={gameState !== GameState.IDLE} style={{ color: LASER_COLORS[laserColorIndex].color }} className="px-3 py-2 bg-gray-800 border border-gray-600 font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 text-sm"><LaserIcon className="h-5 w-5"/><span className="hidden sm:inline">{LASER_COLORS[laserColorIndex].name}</span></button>
            <button onClick={() => setIsAutoAimActive(a => !a)} disabled={gameState !== GameState.IDLE && gameState !== GameState.PAUSED} className={`px-3 py-2 border font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center space-x-2 text-sm ${isAutoAimActive ? 'bg-green-500 text-black border-green-400' : 'bg-gray-800 text-white border-gray-600'}`}><AutoAimIcon className="h-5 w-5"/><span>Auto-Aim</span></button>
            <button onClick={togglePause} disabled={gameState !== GameState.IDLE && gameState !== GameState.PAUSED} className="px-3 py-2 bg-gray-800 border border-gray-600 font-bold uppercase tracking-wider rounded-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 text-white"><span className="sr-only">Pause/Resume</span>{gameState === GameState.PAUSED ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}</button>
          </div>
           <div className="w-full h-[1px] bg-cyan-500/30"></div>
           <div className="flex items-center justify-center w-full space-x-4">
              <div className="flex items-center space-x-2 text-green-400"><HealthIcon className="h-5 w-5" /><div className="w-40 h-4 bg-gray-800 border border-green-700 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300" style={{width: `${(playerHealth / MAX_PLAYER_HEALTH) * 100}%`}}></div></div></div>
              <div className="text-center w-36"><p className="text-xs text-white truncate">{statusMessage}</p><div className="h-1 w-full bg-cyan-900/50 mt-1 rounded-full overflow-hidden"><div className={`h-1 bg-cyan-400 transition-all duration-300 ${gameState === GameState.IDLE || gameState === GameState.PAUSED ? 'w-full' : 'w-0'}`}></div></div><span className="text-[10px] uppercase text-cyan-400/80">System Status</span></div>
           </div>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">
            (C) Noam Gold AI 2025 | <a href="mailto:gold.noam@gmail.com" className="hover:text-cyan-400 transition-colors">Send Feedback</a>
        </div>
      </footer>
    </div>
  );
};

export default App;