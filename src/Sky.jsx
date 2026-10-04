import { useEffect, useRef } from 'react';
import { createSkyRenderer } from './sky-renderer.js';

export default function Sky({ catalog, className = 'celestial-sky' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const renderer = createSkyRenderer(canvasRef.current, catalog);
    return () => renderer.destroy();
  }, [catalog]);

  return <canvas id="celestial-sky" className={className} ref={canvasRef} aria-hidden="true" />;
}
