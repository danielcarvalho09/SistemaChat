import { useEffect, useRef, useState } from 'react';
import createGlobe from 'cobe';

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let phi = 0;
    let width = 0;

    if (!canvasRef.current) return;

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    try {
      const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 0,
      diffuse: 0.8,
      mapSamples: 16000,
      mapBrightness: 10,
      baseColor: [0.95, 0.95, 0.95],
      markerColor: [0.9, 0.9, 0.95],
      glowColor: [1, 1, 1],
      markers: [
        { location: [37.7595, -122.4367], size: 0.03 },
        { location: [40.7128, -74.006], size: 0.1 },
        { location: [-23.5505, -46.6333], size: 0.05 },
        { location: [51.5074, -0.1278], size: 0.05 },
        { location: [35.6762, 139.6503], size: 0.05 },
      ],
      onRender: (state) => {
        state.phi = phi;
        phi += 0.002; // Rotação mais lenta e suave
        state.width = width * 2;
        state.height = width * 2;
      },
    });

      return () => {
        window.removeEventListener('resize', onResize);
        globe.destroy();
      };
    } catch (err) {
      console.error('Error creating globe:', err);
      setError(true);
    }
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-400 text-sm">Globo 3D não disponível</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          aspectRatio: '1',
          contain: 'layout style size',
        }}
      />
    </div>
  );
}
