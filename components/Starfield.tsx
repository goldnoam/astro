import React, { useRef, useEffect, useState, useCallback } from 'react';
import { drag as d3drag, select, GeoProjection } from 'd3';
import { CelestialObject, EnemyShip } from '../types';

interface StarfieldProps {
  celestialObjects: CelestialObject[];
  onTargetClick: (target: CelestialObject, screenPos: [number, number]) => void;
  isLeaping: boolean;
  isPaused: boolean;
  projection: GeoProjection;
}

const Starfield: React.FC<StarfieldProps> = ({ celestialObjects, onTargetClick, isLeaping, isPaused, projection }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameId = useRef<number>();
  const [isDragging, setIsDragging] = useState(false);
  const [, forceRender] = useState(0);

  const memoizedForceRender = useCallback(() => forceRender(c => c + 1), []);
  
  useEffect(() => {
    const resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const baseScale = Math.min(width, height) / 2 * 0.9;
        const currentScaleRatio = projection.scale() / (projection.clipAngle(90).scale() || baseScale);
        projection.scale(baseScale * currentScaleRatio).translate([width / 2, height / 2]);
        memoizedForceRender();
    };
    resize();
    
    const svg = select(svgRef.current!);

    const drag = d3drag<SVGSVGElement, unknown>()
        .on('start', () => setIsDragging(true))
        .subject((event) => {
            const r = projection.rotate();
            return { x: event.x, y: event.y, r: r };
        })
        .on('drag', (event) => {
            const rotate = projection.rotate();
            const k = 75 / projection.scale();
            projection.rotate([ rotate[0] + event.dx * k, rotate[1] - event.dy * k, rotate[2] ]);
            memoizedForceRender();
        })
        .on('end', () => setIsDragging(false));
    
    svg.call(drag);
    
    const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        const currentScale = projection.scale();
        let newScale = currentScale - event.deltaY * 0.1;
        newScale = Math.max(100, Math.min(2000, newScale)); // Clamp zoom
        projection.scale(newScale);
        memoizedForceRender();
    };
    
    const svgNode = svgRef.current;
    svgNode?.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', resize);
    
    const animate = () => {
        if (!document.hidden && !isDragging && !isPaused) {
            const rotate = projection.rotate();
            projection.rotate([rotate[0] + 0.015, rotate[1], rotate[2]]);
            memoizedForceRender();
        }
        animationFrameId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      svgNode?.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', resize);
      svg.on('.drag', null);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [memoizedForceRender, isDragging, isPaused, projection]);

  const getShipDetails = (ship: EnemyShip) => {
    const s = ship.size;
    switch(ship.shipType) {
        // Level 1 Ships
        case 'fighter': return { path: `M0,${-s*2} L${s*1.5},${s*1.5} L${-s*1.5},${s*1.5} Z`, engine: `M0,${s*1.5} l-0.5,1 l1,0 Z`, light: {cy: -s * 0.5, r: 0.5} };
        case 'interceptor': return { path: `M0,${-s*2.5} L${s},${s*2} L0,${s*1.5} L${-s},${s*2} Z`, engine: `M0,${s*1.75} l-0.5,1 l1,0 Z`, light: {cy: -s, r: 0.4} };
        case 'cruiser': return { path: `M0,${-s*3} L${s},${s*3} L0,${s*2} L${-s},${s*3} Z`, engine: `M0,${s*2.5} l-0.7,1.2 l1.4,0 Z`, light: {cy: -s * 1.5, r: 0.6} };
        case 'bomber': return { path: `M0,${-s*2} L${s*3},${s} L${s*1.5},${s*2.5} L${-s*1.5},${s*2.5} L${-s*3},${s} Z`, engine: `M0,${s*2} l-1,1 l2,0 Z`, light: {cy: -s, r: 0.8} };
        case 'dreadnought': return { path: `M0,${-s*3} L${s*2},${s*3} L${s*3},${s*1} L${-s*3},${s*1} L${-s*2},${s*3} Z`, engine: `M0,${s*2} l-1.5,1.5 l3,0 Z`, light: {cy: -s * 1.5, r: 1} };
        // Level 2+ Ships (Mark II)
        case 'fighter-mk2': return { path: `M0 -${s*2} l ${s*1.5} ${s*3.5} h -${s*3} Z M0 ${s*0.5} l ${s*2} ${s*1} h -${s*4} Z`, engine: `M0,${s*1.5} l-0.6,1.1 l1.2,0 Z`, light: {cy: -s*0.5, r: 0.6} };
        case 'interceptor-mk2': return { path: `M0 -${s*3} l ${s} ${s*5} l ${s*1.5} -${s*2.5} h -${s*5} l ${s*1.5} ${s*2.5} Z`, engine: `M0,${s*2} l-0.5,1 l1,0 Z`, light: {cy: -s*2, r: 0.5} };
        case 'cruiser-mk2': return { path: `M0 -${s*3} l ${s*2} ${s*6} l -${s*2} -${s*2} l -${s*2} ${s*2} l ${s*2} -${s*6} Z`, engine: `M0,${s*3} l-1,1.5 l2,0 Z`, light: {cy: -s, r: 0.8} };
        case 'bomber-mk2': return { path: `M0 -${s*2} L${s*4} ${s*1} L${s*1} ${s*3} L-${s*1} ${s*3} L-${s*4} ${s*1} Z`, engine: `M0,${s*2} l-1.5,1 l3,0 Z`, light: {cy: 0, r: 1} };
        case 'dreadnought-mk2': return { path: `M0 -${s*4} L${s*2} ${s*4} L${s*4} ${s*2} L${s*2} ${s*2} L0 ${s*3} L-${s*2} ${s*2} L-${s*4} ${s*2} L-${s*2} ${s*4} Z`, engine: `M0,${s*2.5} l-2,1.5 l4,0 Z`, light: {cy: -s*2, r: 1.2} };
        default: return { path: `M0,${-s*3} L${s*2.5},${s*2} L${-s*2.5},${s*2} Z`, engine: `M0,${s*2} l-1,1 l2,0 Z`, light: {cy: 0, r: 0.5} };
    }
  }

  return (
    <svg ref={svgRef} width="100%" height="100%" className={`absolute inset-0 transition-transform duration-500 cursor-move ${isLeaping ? 'quantum-leap' : ''}`}>
      <defs>
        <radialGradient id="starGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.8)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0)', stopOpacity: 1 }} />
        </radialGradient>
        <filter id="enemyGlow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="glow" />
            <feComposite in="glow" in2="SourceGraphic" operator="over" />
        </filter>
        <radialGradient id="engineGlow">
            <stop offset="0%" stopColor="#87CEEB" />
            <stop offset="100%" stopColor="#00BFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heartGlow">
            <stop offset="0%" stopColor="#FF85B2" />
            <stop offset="100%" stopColor="#FFC0CB" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="boostGlow">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFFF00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g>
        {celestialObjects.map((target) => {
          const projected = projection(target.coordinates);
          if (!projected) return null;

          const [x, y] = projected;
          const [cx, cy] = projection.translate();
          const scale = projection.scale();
          if (Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)) > scale) {
            return null;
          }
          
          let element: React.ReactElement | null = null;

          switch (target.type) {
            case 'star':
              element = (
                <g>
                  <circle r={target.size * 2} fill="url(#starGlow)" className="opacity-50 group-hover:opacity-100 transition-opacity" />
                  <circle r={target.size} fill={target.color} />
                </g>
              );
              break;
            case 'ship':
              const details = getShipDetails(target);
              const isMk2 = target.shipType.includes('mk2');
              element = (
                <g style={{filter: 'url(#enemyGlow)'}}>
                  <path d={details.engine} fill="url(#engineGlow)" className="engine-pulse" />
                  <path d={details.path} fill={isMk2 ? "#9A2A2A" : "#C32020"} stroke={isMk2 ? "#FF8C8C" : "#FF6969"} strokeWidth="0.5" className="group-hover:fill-red-400 transition-colors" />
                  <circle cx={0} cy={details.light.cy} r={details.light.r} fill="white" className="light-blink" />
                </g>
              );
              break;
            case 'asteroid':
              const sAst = target.size * 2;
              element = <path d={`M${sAst*0},${sAst*(-1)} L${sAst*0.87},${sAst*(-0.5)} L${sAst*0.87},${sAst*0.5} L${sAst*0},${sAst*1} L${sAst*(-0.87)},${sAst*0.5} L${sAst*(-0.87)},${sAst*(-0.5)} Z`} fill="#8B4513" stroke="#A0522D" strokeWidth="0.5" className="group-hover:fill-yellow-700 transition-colors" />;
              break;
            case 'heart_star':
                const sHeart = target.size * 1.5;
                element = (
                    <g>
                        <circle r={sHeart * 2} fill="url(#heartGlow)" className="opacity-70 group-hover:opacity-100 transition-opacity" />
                        <path d={`M0,${-sHeart*0.5} C ${sHeart},${-sHeart*2} ${sHeart*2},${-sHeart*1.5} 0,${sHeart*1.5} C ${-sHeart*2},${-sHeart*1.5} ${-sHeart},${-sHeart*2} 0,${-sHeart*0.5} Z`} fill="#FF1493" stroke="#FF85B2" strokeWidth="0.5" />
                    </g>
                )
                break;
            case 'boost_star':
                const sBoost = target.size;
                const starPath = `M0,${-sBoost*2} L${sBoost*0.5},${-sBoost*0.5} L${sBoost*2},0 L${sBoost*0.5},${sBoost*0.5} L0,${sBoost*2} L${-sBoost*0.5},${sBoost*0.5} L${-sBoost*2},0 L${-sBoost*0.5},${-sBoost*0.5} Z`;
                element = (
                    <g>
                        <circle r={sBoost * 2.5} fill="url(#boostGlow)" className="opacity-80 group-hover:opacity-100 transition-opacity" />
                        <path d={starPath} fill="#FFD700" stroke="#FFFF00" strokeWidth="0.5" />
                    </g>
                );
                break;
          }

          if (!element) return null;

          const targetGroup = (
            <g transform={`translate(${projected[0]}, ${projected[1]})`} 
               className="cursor-pointer group"
               onClick={(e) => { e.stopPropagation(); onTargetClick(target, projected); }}>
              {element}
            </g>
          );

          return React.cloneElement(targetGroup, { key: target.id });
        })}
      </g>
    </svg>
  );
};

export default React.memo(Starfield);