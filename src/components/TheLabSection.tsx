import React, { useRef, useEffect, useState } from 'react';

interface Stage {
  step: string;
  title: string;
  subtitle: string;
  description: string;
}

const stages: Stage[] = [
  {
    step: '01',
    title: 'IDEA',
    subtitle: 'Raw Hypotheses',
    description: 'Every system begins as an intuition or mathematical theory waiting to be challenged.',
  },
  {
    step: '02',
    title: 'EXPERIMENT',
    subtitle: 'Rapid Prototyping',
    description: 'Hardware, software, and AI models built to test the limits of what is physically and computationally possible.',
  },
  {
    step: '03',
    title: 'PROTOTYPE',
    subtitle: 'Iterative Refinement',
    description: 'Versioned builds subjected to rigorous benchmarking, architecture audits, and live testing.',
  },
  {
    step: '04',
    title: 'SYSTEM',
    subtitle: 'Published Impact',
    description: 'Production-ready technology published to the world with open architecture and documentation.',
  },
];

export const TheLabSection: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVis(true);
      },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="the-lab" ref={ref} className="py-24 md:py-32 bg-dark bg-circuit relative">
      <div className="max-w-7xl mx-auto px-6 relative z-10 space-y-16">
        {/* Header */}
        <div
          className={`max-w-2xl space-y-3 transition-all duration-700 ${
            vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="inline-flex items-center gap-2 font-mono-custom text-[11px] tracking-[0.25em] text-eg uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-eg animate-pulse" />
            METHODOLOGY
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            THE LAB
          </h2>
          <p className="font-sans text-base sm:text-lg text-white/60 font-light leading-relaxed pt-1">
            Ideas become experiments. Experiments become systems.
          </p>
        </div>

        {/* 4-Stage Progressive Pipeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stages.map((st, i) => (
            <div
              key={st.step}
              className={`group glass-dark rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-eg/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-eg/5 relative flex flex-col justify-between ${
                vis ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Corner accent */}
              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-eg/30 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-4">
                {/* Step indicator */}
                <div className="flex items-center justify-between">
                  <span className="font-mono-custom text-xs font-bold text-eg bg-eg/10 border border-eg/25 px-2.5 py-1 rounded-md">
                    {st.step}
                  </span>
                  <span className="font-mono-custom text-[10px] text-white/30 uppercase tracking-widest">
                    STAGE {st.step}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-display text-xl font-bold text-white group-hover:text-eg transition-colors tracking-wide">
                    {st.title}
                  </h3>
                  <p className="font-mono-custom text-[11px] text-eg/70 tracking-wider uppercase mt-0.5">
                    {st.subtitle}
                  </p>
                </div>

                {/* Description */}
                <p className="font-sans text-xs text-white/60 leading-relaxed pt-1">
                  {st.description}
                </p>
              </div>

              {/* Bottom line progress */}
              <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
                <span className="font-mono-custom text-[9px] text-white/25 uppercase tracking-widest">
                  {i < stages.length - 1 ? 'PROCEEDS TO →' : 'PUBLISHED ✓'}
                </span>
                <div className="w-2 h-2 rounded-full bg-eg/20 group-hover:bg-eg transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TheLabSection;
