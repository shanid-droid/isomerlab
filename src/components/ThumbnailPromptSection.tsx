import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { generateThumbnailPrompt } from '../lib/thumbnailPrompt';

interface ThumbnailPromptSectionProps {
  projectName: string;
  projectDescription: string;
  hasProductImage: boolean;
}

const ThumbnailPromptSection: React.FC<ThumbnailPromptSectionProps> = ({
  projectName,
  projectDescription,
  hasProductImage,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [toastVisible, setToastVisible] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const prompt = useMemo(
    () =>
      generateThumbnailPrompt({
        projectName,
        projectDescription,
        hasProductImage,
      }),
    [projectName, projectDescription, hasProductImage]
  );

  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = window.setTimeout(() => setToastVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [toastVisible]);

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState('copied');
      setToastVisible(true);
      return true;
    } catch {
      setFallbackOpen(true);
      return false;
    }
  }, [prompt]);

  const handleCopyClick = async () => {
    await copyPrompt();
  };

  const handlePreviewCopy = async () => {
    const ok = await copyPrompt();
    if (ok) setPreviewOpen(false);
  };

  return (
    <>
      <div className="rounded-xl border border-eg/15 bg-dark-200/50 p-4 space-y-3">
        <div>
          <h4 className="font-mono-custom text-[11px] text-eg uppercase tracking-wider">
            AI Thumbnail Prompt
          </h4>
          <p className="font-sans text-[11px] text-white/45 mt-1 leading-relaxed">
            Generate a professional ISOMER LAB thumbnail using any AI image generator.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleCopyClick}
            className="flex-1 btn-primary py-2.5 text-[11px] font-mono-custom"
          >
            {copyState === 'copied' ? '✓ Prompt Copied' : 'Copy Thumbnail Prompt'}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex-1 btn-outline py-2.5 text-[11px] font-mono-custom"
          >
            Preview Prompt
          </button>
        </div>

        {hasProductImage && (
          <p className="font-sans text-[10px] text-white/35 leading-relaxed border-t border-eg/10 pt-3">
            Tip: Attach your uploaded product image together with this prompt when using an AI
            image generator for the most accurate result.
          </p>
        )}
      </div>

      {/* Toast */}
      {toastVisible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl border border-eg/30 bg-dark-200/95 backdrop-blur-sm shadow-eg-sm font-mono-custom text-xs text-eg pointer-events-none"
        >
          Thumbnail prompt copied!
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-eg/20 bg-dark-200/95 shadow-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-eg/10">
              <h3 className="font-mono-custom text-sm text-eg uppercase tracking-wider">
                AI Thumbnail Prompt
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="text-white/40 hover:text-white text-lg leading-none px-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <textarea
              readOnly
              value={prompt}
              className="flex-1 min-h-[280px] max-h-[50vh] w-full bg-dark/80 border-0 px-5 py-4 text-[11px] text-white/80 font-mono-custom leading-relaxed resize-none focus:outline-none select-text"
              onClick={(e) => e.currentTarget.select()}
            />

            <div className="flex gap-2 px-5 py-4 border-t border-eg/10">
              <button
                type="button"
                onClick={handlePreviewCopy}
                className="flex-1 btn-primary py-2 text-[11px] font-mono-custom"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="flex-1 border border-white/10 hover:border-white/30 rounded-xl py-2 text-[11px] font-mono-custom text-white/60 hover:text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clipboard fallback modal */}
      {fallbackOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setFallbackOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-eg/20 bg-dark-200/95 shadow-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-eg/10">
              <h3 className="font-mono-custom text-sm text-eg uppercase tracking-wider">
                Copy Prompt Manually
              </h3>
              <p className="font-sans text-[11px] text-white/45 mt-1">
                Clipboard access was blocked. Select the text below and copy it manually.
              </p>
            </div>

            <textarea
              readOnly
              value={prompt}
              className="flex-1 min-h-[280px] max-h-[50vh] w-full bg-dark/80 border-0 px-5 py-4 text-[11px] text-white/80 font-mono-custom leading-relaxed resize-none focus:outline-none select-text"
              onFocus={(e) => e.currentTarget.select()}
            />

            <div className="px-5 py-4 border-t border-eg/10">
              <button
                type="button"
                onClick={() => setFallbackOpen(false)}
                className="w-full border border-white/10 hover:border-white/30 rounded-xl py-2 text-[11px] font-mono-custom text-white/60 hover:text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ThumbnailPromptSection;
