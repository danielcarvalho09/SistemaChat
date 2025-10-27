import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

/**
 * Componente de teste simplificado do Globe
 * Use este componente se o Globe principal não funcionar
 */
export function GlobeTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      console.error('❌ Canvas ref não encontrado');
      return;
    }

    console.log('✅ Iniciando Globe Test...');

    let phi = 0;

    try {
      const globe = createGlobe(canvasRef.current, {
        devicePixelRatio: 2,
        width: 800,
        height: 800,
        phi: 0,
        theta: 0.3,
        dark: 0,
        diffuse: 0.4,
        mapSamples: 16000,
        mapBrightness: 1.2,
        baseColor: [1, 1, 1],
        markerColor: [30 / 255, 58 / 255, 138 / 255], // Azul escuro
        glowColor: [1, 1, 1],
        markers: [
          { location: [14.5995, 120.9842], size: 0.03 },
          { location: [19.076, 72.8777], size: 0.1 },
          { location: [23.8103, 90.4125], size: 0.05 },
          { location: [30.0444, 31.2357], size: 0.07 },
          { location: [39.9042, 116.4074], size: 0.08 },
          { location: [-23.5505, -46.6333], size: 0.1 },
          { location: [19.4326, -99.1332], size: 0.1 },
          { location: [40.7128, -74.006], size: 0.1 },
          { location: [34.6937, 135.5022], size: 0.05 },
          { location: [41.0082, 28.9784], size: 0.06 },
        ],
        onRender: (state) => {
          phi += 0.005;
          state.phi = phi;
          state.width = 800;
          state.height = 800;
        },
      });

      console.log('✅ Globe criado com sucesso!');

      // Tornar visível após 100ms
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.style.opacity = '1';
          console.log('✅ Globe visível!');
        }
      }, 100);

      return () => {
        console.log('🧹 Destruindo Globe...');
        globe.destroy();
      };
    } catch (error) {
      console.error('❌ Erro ao criar Globe:', error);
    }
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '800px',
          maxHeight: '800px',
          opacity: 0,
          transition: 'opacity 0.5s ease-in-out',
        }}
      />
    </div>
  );
}
