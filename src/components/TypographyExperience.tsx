import React, { useRef, useEffect, useState } from 'react';

export const TypographyExperience: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVis(true);
      },
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const words = [
    { text: 'CREATE', delay: '0ms' },
    { text: 'EXPLORE', delay: '120ms' },
    { text: 'EXPERIMENT', delay: '240ms' },
    { text: 'BUILD', delay: '360ms' },
  ];

  return (
    <section
      ref={ref}
      className="py-16 md:py-24 bg-dark overflow-hidden border-y border-white/5 select-none relative"
    >
      {/* Background ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,255,136,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {words.map((w, i) => (
            <div
              key={w.text}
              className={`flex flex-col items-center justify-center p-4 transition-all duration-700 ${
                vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: w.delay }}
            >
              <span className="font-mono-custom text-[10px] tracking-[0.3em] text-eg/50 uppercase mb-2">
                PHASE 0{i + 1}
              </span>
              <span className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-widest text-white/80 hover:text-eg transition-colors duration-300">
                {w.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TypographyExperience;
