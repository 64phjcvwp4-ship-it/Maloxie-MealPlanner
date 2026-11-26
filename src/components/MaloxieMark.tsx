import React, { useEffect, useState } from 'react';

const MALOXIE_LOGO_SRC = '/assets/aistudio/IMG_4277_e1118095.jpeg';

let cachedTransparentWhiteUrl: string | null = null;

function buildTransparentWhiteLogo(src: string): Promise<string> {
  if (cachedTransparentWhiteUrl) {
    return Promise.resolve(cachedTransparentWhiteUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const lum = (r + g + b) / 3;

            if (lum < 210) {
              // Convert dark ink to crisp white with smooth anti-aliased alpha
              const alpha = Math.min(255, Math.max(0, Math.round(((210 - lum) / 140) * 255)));
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
              data[idx + 3] = alpha;

              if (alpha > 15) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            } else {
              data[idx + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        if (maxX > minX && maxY > minY) {
          const cropW = maxX - minX + 1;
          const cropH = maxY - minY + 1;
          const outCanvas = document.createElement('canvas');
          outCanvas.width = cropW;
          outCanvas.height = cropH;
          const outCtx = outCanvas.getContext('2d');
          if (outCtx) {
            outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
            const url = outCanvas.toDataURL('image/png');
            cachedTransparentWhiteUrl = url;
            resolve(url);
            return;
          }
        }

        const fallbackUrl = canvas.toDataURL('image/png');
        cachedTransparentWhiteUrl = fallbackUrl;
        resolve(fallbackUrl);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

interface MaloxieMarkProps {
  className?: string;
}

export const MaloxieMark: React.FC<MaloxieMarkProps> = ({
  className = 'h-9 w-auto',
}) => {
  const [processedSrc, setProcessedSrc] = useState<string | null>(
    cachedTransparentWhiteUrl
  );

  useEffect(() => {
    let active = true;
    if (!cachedTransparentWhiteUrl) {
      buildTransparentWhiteLogo(MALOXIE_LOGO_SRC).then((url) => {
        if (active) setProcessedSrc(url);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  if (processedSrc && processedSrc !== MALOXIE_LOGO_SRC) {
    return (
      <img
        src={processedSrc}
        alt="Maloxie logo"
        className={`object-contain select-none shrink-0 ${className}`}
      />
    );
  }

  return (
    <img
      src={MALOXIE_LOGO_SRC}
      alt="Maloxie logo"
      className={`object-contain invert mix-blend-screen select-none shrink-0 ${className}`}
    />
  );
};
