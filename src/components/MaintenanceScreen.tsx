import React from 'react';
import { Link } from 'react-router-dom';
import { IsomerLogo } from './ui';
import { DEFAULT_MAINTENANCE_SUBMESSAGE } from '../lib/constants';

interface MaintenanceScreenProps {
  message?: string;
}

const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  message = 'ISOMER LAB is currently under maintenance.',
}) => (
  <div className="min-h-screen bg-dark bg-circuit text-white flex flex-col items-center justify-center px-6 selection:bg-eg/30">
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-eg/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-eg/3 rounded-full blur-3xl" />
    </div>

    <div className="relative z-10 max-w-lg w-full text-center space-y-8">
      <Link to="/" className="inline-block">
        <IsomerLogo size="lg" />
      </Link>

      <div className="glass rounded-2xl p-10 border border-eg/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-eg/60" />
        <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-eg/60" />
        <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-eg/60" />
        <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-eg/60" />

        <div className="w-16 h-16 rounded-2xl border border-eg/30 bg-eg/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">⚙</span>
        </div>

        <p className="font-mono-custom text-[10px] tracking-[0.3em] text-eg/80 uppercase mb-3">
          ISOMER LAB
        </p>

        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-wider text-white mb-4 text-glow-sm">
          SITE UNDER MAINTENANCE
        </h1>

        <p className="font-sans text-sm text-white/70 leading-relaxed mb-2">
          {message}
        </p>
        <p className="font-sans text-sm text-white/50 leading-relaxed">
          {DEFAULT_MAINTENANCE_SUBMESSAGE}
        </p>
      </div>

      <Link
        to="/"
        className="btn-outline py-2.5 px-6 text-xs font-mono-custom inline-flex items-center gap-2"
      >
        RETURN TO HOME
      </Link>
    </div>
  </div>
);

export default MaintenanceScreen;
