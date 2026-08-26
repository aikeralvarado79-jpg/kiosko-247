import { formatUsd } from '../../utils/format';

export default function Money({ value, className = '' }) {
  const str = formatUsd(value);
  const intPart = str.replace(/[^0-9]/g, '').slice(0, -2) || '0';
  const tail = str.slice(str.indexOf(intPart.slice(-Math.max(intPart.length, 1))) + intPart.length);
  const symbol = str.startsWith('$') ? '$' : '';
  const digits = String(intPart).split('');
  return (
    <span className={`inline-flex items-baseline tabular-nums ${className}`}>
      {symbol}
      {digits.map((d, i) => (
        <span key={`${i}-${digits.length}`} className="odo-digit">
          <span className="odo-stack" style={{ transform: `translateY(-${Number(d)}em)` }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <span key={n}>{n}</span>)}
          </span>
        </span>
      ))}
      {tail}
    </span>
  );
}
