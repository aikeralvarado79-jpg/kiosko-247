import { useState, useRef, useEffect } from 'react';
import { haptic } from '../utils/haptics.js';
import { sfx } from '../experience.js';

const THEO_HEART = 'M12 21s-7.5-4.9-10-9.2C.4 8.6 2 5 5.5 5c2 0 3.4 1.1 4.3 2.6L12 10l2.2-2.4C15.1 6.1 16.5 5 18.5 5 22 5 23.6 8.6 22 11.8 19.5 16.1 12 21 12 21z';

export default function Theo({ mood = 'idle', className = 'w-20 h-16' }) {
  const happy = mood === 'happy' || mood === 'celebrate';
  const asleep = mood === 'sleep';
  const svgRef = useRef(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [fx, setFx] = useState(null);
  const [hearts, setHearts] = useState([]);
  const press = useRef(false);
  const petAccum = useRef(0);
  const timersRef = useRef([]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  const spawnHeart = () => {
    const id = Date.now() + Math.random();
    const x = 52 + Math.random() * 96;
    setHearts((h) => [...h, { id, x }]);
    timersRef.current.push(setTimeout(() => setHearts((h) => h.filter((v) => v.id !== id)), 1000));
  };

  const gazeFrom = (e) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setGaze({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny))
    });
  };

  const onPointerDown = (e) => {
    press.current = true;
    petAccum.current = 0;
    if (!fx) setFx('pet');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    gazeFrom(e);
  };
  const onPointerMove = (e) => {
    gazeFrom(e);
    if (!press.current) return;
    if (e.movementX != null) {
      petAccum.current += Math.abs(e.movementX) + Math.abs(e.movementY ?? 0);
      if (petAccum.current > 130) {
        petAccum.current = 0;
        spawnHeart();
        haptic('tap');
      }
    }
  };
  const onPointerUp = () => {
    press.current = false;
    if (fx === 'pet') {
      const t = setTimeout(() => setFx((f) => (f === 'pet' ? null : f)), 650);
      timersRef.current.push(t);
    }
  };
  const boop = (e) => {
    e.stopPropagation();
    if (fx === 'boop') return;
    setFx('boop');
    sfx.doubleTick();
    haptic('added');
    spawnHeart();
    const t = setTimeout(() => setFx(null), 600);
    timersRef.current.push(t);
  };

  const bliss = happy || fx === 'pet';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 170"
      className={`${className} ${mood === 'happy' ? 'theo-happy' : ''} ${mood === 'celebrate' ? 'theo-celebrate' : ''} ${mood === 'sleep' ? 'theo-sleep' : ''} ${mood === 'pull' ? 'theo-pull' : ''} ${fx === 'pet' ? 'theo-petting' : ''} ${fx === 'boop' ? 'theo-boop' : ''}`}
      style={{ touchAction: 'pan-y', cursor: 'pointer' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { press.current = false; }}
      role="img"
      aria-label="Theo, la mascota de Kiosko 24/7"
    >
      <defs>
        <radialGradient id="theoFur" cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#bd8757" />
          <stop offset="55%" stopColor="#8f5f33" />
          <stop offset="100%" stopColor="#69401f" />
        </radialGradient>
        <radialGradient id="theoBody" cx="40%" cy="24%" r="90%">
          <stop offset="0%" stopColor="#a06f41" />
          <stop offset="65%" stopColor="#7d5228" />
          <stop offset="100%" stopColor="#5c3a1b" />
        </radialGradient>
        <linearGradient id="theoEar" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#7a4c26" />
          <stop offset="100%" stopColor="#452a12" />
        </linearGradient>
        <radialGradient id="theoCream" cx="50%" cy="36%" r="80%">
          <stop offset="0%" stopColor="#f8e7c9" />
          <stop offset="100%" stopColor="#ddb986" />
        </radialGradient>
        <linearGradient id="theoCollar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <filter id="theoSoft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      <ellipse cx="100" cy="160" rx="56" ry="9" fill="#000000" opacity="0.24" filter="url(#theoSoft)" />

      {hearts.map((h) => (
        <path key={h.id} className="theo-heart" d={THEO_HEART} fill="#fb7185"
          transform={`translate(${h.x - 7}, 34) scale(0.62)`} />
      ))}

      <g className={asleep ? 'theo-inner theo-breathe' : 'theo-inner'}>
        <g className="theo-tail">
          <path d="M136 120 Q158 112 166 92" stroke="#5f3c1e" strokeWidth="13" fill="none" strokeLinecap="round" />
          <path d="M140 116 Q156 108 163 94" stroke="#a9744a" strokeWidth="6.5" fill="none" strokeLinecap="round" opacity="0.85" />
        </g>

        <ellipse cx="100" cy="120" rx="43" ry="37" fill="url(#theoBody)" />
        <circle cx="129" cy="127" r="26" fill="url(#theoBody)" />
        <path d="M60 108 q6 -6 12 -2 M138 104 q6 -4 10 2 M70 132 q5 -5 11 -3 M126 140 q6 -4 11 -1"
          stroke="#b98254" strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />

        <ellipse cx="95" cy="129" rx="23" ry="26" fill="url(#theoCream)" />
        <path d="M88 118 q4 -6 9 -7 M96 124 q5 -5 10 -5 M84 128 q4 -4 8 -4"
          stroke="#fff3dc" strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />

        <ellipse cx="147" cy="152" rx="13" ry="7" fill="url(#theoCream)" transform="rotate(-10 147 152)" />
        <path d="M143 149 v5 M149 148.5 v5.5" stroke="#d9bd94" strokeWidth="1.6" strokeLinecap="round" />

        <rect x="74" y="133" width="15" height="26" rx="7.5" fill="url(#theoBody)" />
        <rect x="106" y="133" width="15" height="26" rx="7.5" fill="url(#theoBody)" />
        <ellipse cx="81.5" cy="158" rx="11" ry="6.5" fill="url(#theoCream)" />
        <ellipse cx="113.5" cy="158" rx="11" ry="6.5" fill="url(#theoCream)" />
        <path d="M78.5 156 v3.4 M83 155.6 v3.8 M110.5 156 v3.4 M115 155.6 v3.8" stroke="#d9bd94" strokeWidth="1.6" strokeLinecap="round" />

        <path d="M64 100 L72 91 L80 100 L88 90 L96 99 L104 89 L112 99 L120 90 L128 100 L136 92 L138 103 L64 106 Z"
          fill="#8f5f33" opacity="0.95" />
        <path d="M76 96 l5 -5 M92 93 l5 -5 M108 93 l5 -5 M124 96 l5 -5"
          stroke="#e8cf9f" strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />

        <rect x="70" y="102" width="60" height="10" rx="5" fill="url(#theoCollar)" />
        <circle cx="100" cy="116" r="5.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" />
        <circle cx="98.4" cy="114.4" r="1.3" fill="#fef3c7" opacity="0.9" />

        <g className="theo-ear-l">
          <path d="M66 28 C48 22 32 38 35 62 C36 79 47 90 54 84 C61 77 64 52 68 44 Z" fill="url(#theoEar)" />
          <path d="M60 38 C50 37 43 49 45 62" stroke="#c98a58" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        </g>
        <g className="theo-ear-r">
          <path d="M134 28 C152 22 168 38 165 62 C164 79 153 90 146 84 C139 77 136 52 132 44 Z" fill="url(#theoEar)" />
          <path d="M140 38 C150 37 157 49 155 62" stroke="#c98a58" strokeWidth="3" fill="none" opacity="0.7" strokeLinecap="round" />
        </g>

        <ellipse cx="100" cy="60" rx="37" ry="35" fill="url(#theoFur)" />
        <path d="M68 42 Q74 30 88 25" stroke="#d9a86e" strokeWidth="2.6" fill="none" opacity="0.5" strokeLinecap="round" filter="url(#theoSoft)" />
        <path d="M90 29 Q100 22 110 29 M84 33 Q96 26 105 32" stroke="#a9744a" strokeWidth="2.2" fill="none" opacity="0.55" strokeLinecap="round" />
        <ellipse cx="82" cy="43" rx="4.2" ry="2.5" fill="#c99b62" opacity="0.85" />
        <ellipse cx="118" cy="43" rx="4.2" ry="2.5" fill="#c99b62" opacity="0.85" />

        <ellipse cx="100" cy="66" rx="17" ry="11" fill="url(#theoFur)" opacity="0.6" />
        <ellipse cx="100" cy="78" rx="20" ry="15" fill="url(#theoCream)" />
        <g stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" strokeLinecap="round">
          <path d="M81 76 Q64 73 56 66" /><path d="M81 79 Q63 79 55 76" /><path d="M81 82 Q65 85 58 90" />
          <path d="M119 76 Q136 73 144 66" /><path d="M119 79 Q137 79 145 76" /><path d="M119 82 Q135 85 142 90" />
        </g>
        <path d="M92 70 Q100 66 108 70 Q106 77 100 79 Q94 77 92 70 Z" fill="#2b1a0e" />
        <circle cx="96.8" cy="70.4" r="1.7" fill="#ffffff" opacity="0.9" />
        <circle cx="102.6" cy="71.6" r="0.9" fill="#ffffff" opacity="0.5" />

        {bliss ? (
          <g>
            <path d="M89 83 Q100 94 111 83 Z" fill="#7c2d3e" />
            <ellipse cx="100" cy="89.5" rx="6" ry="4.6" fill="#ef8ba0" />
            <path d="M100 85 L100 91.5" stroke="#b04a63" strokeWidth="1.4" />
          </g>
        ) : asleep ? (
          <path d="M96 84 Q100 87 104 84" stroke="#4a2d16" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : fx === 'boop' ? (
          <ellipse cx="100" cy="86" rx="3.4" ry="4.2" fill="#4a2d16" />
        ) : (
          <path d="M100 79 Q100 85 95 86 M100 79 Q100 85 105 86" stroke="#4a2d16" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}

        {bliss ? (
          <g stroke="#241505" strokeWidth="3.2" fill="none" strokeLinecap="round">
            <path d="M75 53 Q83 46 91 53" />
            <path d="M109 53 Q117 46 125 53" />
          </g>
        ) : asleep ? (
          <g stroke="#241505" strokeWidth="2.6" fill="none" strokeLinecap="round">
            <path d="M76 53 Q83 57 90 53" />
            <path d="M110 53 Q117 57 124 53" />
          </g>
        ) : (
          <g style={{ transition: 'transform 0.08s linear', transform: `translate(${(gaze.x * 2).toFixed(2)}px, ${(gaze.y * 1.5).toFixed(2)}px)` }}>
            <circle cx="83" cy="53" r="6.6" fill="#2f1c0d" />
            <circle cx="117" cy="53" r="6.6" fill="#2f1c0d" />
            <circle cx="83" cy="53" r="3.1" fill="#120a03" />
            <circle cx="117" cy="53" r="3.1" fill="#120a03" />
            <circle cx="80.8" cy="50.6" r="2" fill="#ffffff" opacity="0.92" />
            <circle cx="114.8" cy="50.6" r="2" fill="#ffffff" opacity="0.92" />
            <circle cx="85" cy="55.4" r="1" fill="#ffffff" opacity="0.55" />
            <circle cx="119" cy="55.4" r="1" fill="#ffffff" opacity="0.55" />
            <g className="theo-lids">
              <rect x="75.5" y="45.5" width="15" height="15" rx="7.5" fill="#8f5f33" />
              <rect x="109.5" y="45.5" width="15" height="15" rx="7.5" fill="#8f5f33" />
            </g>
          </g>
        )}
        {mood === 'celebrate' && (
          <g fill="#e2637a" opacity="0.35">
            <ellipse cx="71" cy="67" rx="6" ry="3.6" />
            <ellipse cx="129" cy="67" rx="6" ry="3.6" />
          </g>
        )}
        {mood === 'celebrate' && (
          <g stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
            <path d="M28 14 L36 22 M172 14 L164 22" />
            <path d="M12 46 L22 48 M188 46 L178 48" />
          </g>
        )}
        {mood === 'pull' && (
          <path d="M62 14 Q100 -4 138 14" stroke="#5eead4" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        )}

        <circle cx="100" cy="73" r="15" fill="transparent" onClickCapture={boop} style={{ cursor: 'pointer' }} />
      </g>
    </svg>
  );
}
