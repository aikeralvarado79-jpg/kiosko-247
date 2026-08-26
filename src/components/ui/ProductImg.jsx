import { useState } from 'react';
import BrandLogo from './BrandLogo';

export default function ProductImg({ product, image, name, brand, alt, className = '', loading = 'lazy', onLoad, imgProps }) {
  const [errored, setErrored] = useState(false);
  const src = product?.image ?? image;
  const label = product?.brand?.trim() || product?.name || brand || name || 'Producto';

  if (!src || errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 select-none ${className || ''}`}
        style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}
        aria-hidden="true"
      >
        <BrandLogo className="w-6 h-6 !rounded-lg shrink-0" />
        <span className="w-full truncate px-1.5 text-center text-[10px] font-bold text-slate-400">{label}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || label}
      loading={loading}
      draggable={false}
      onError={() => setErrored(true)}
      onLoad={(e) => {
        e.currentTarget.classList.add('is-loaded');
        onLoad?.(e);
      }}
      className={`img-load-fade ${className || ''}`}
      {...imgProps}
    />
  );
}
