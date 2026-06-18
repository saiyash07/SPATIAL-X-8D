import { useEffect, useRef } from 'react';
import { audioEngine } from '../../engine/AudioEngine';

export default function Visualizer({ isPlaying, barCount = 32, height = 32 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const idleRef = useRef(new Array(barCount).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let frameData = new Array(barCount).fill(0);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const freqData = audioEngine.getFrequencyData();

      if (freqData && isPlaying) {
        // Downsample FFT bins to barCount bars
        const step = Math.floor(freqData.length / barCount);
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += freqData[i * step + j];
          }
          const avg = sum / step;
          // Smooth the bars
          frameData[i] = frameData[i] * 0.75 + (avg / 255) * 0.25;
        }
      } else {
        // Idle breathing animation
        const t = Date.now() / 1000;
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(t * 1.5 + i * 0.4) * 0.5 + 0.5;
          frameData[i] = frameData[i] * 0.9 + wave * 0.08 * 0.1;
        }
      }

      const barW = (w - barCount - 1) / barCount;
      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, 'rgba(124, 58, 237, 0.9)');
      gradient.addColorStop(0.5, 'rgba(157, 92, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(14, 165, 233, 0.7)');

      for (let i = 0; i < barCount; i++) {
        const barH = Math.max(2, frameData[i] * h);
        const x = i * (barW + 1);
        const y = h - barH;

        ctx.fillStyle = gradient;
        // Rounded top
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, barCount, height]);

  // Resize canvas to its display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="visualizer-wrap" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} className="visualizer-canvas" />
    </div>
  );
}
