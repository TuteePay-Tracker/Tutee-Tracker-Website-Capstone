import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

// Typed interface for the beforeinstallprompt event (not in standard TS types)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWAButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window.navigator as unknown as { standalone?: boolean }).standalone;

  useEffect(() => {
    // Check if already installed as a standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if previously dismissed (persisted across sessions)
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true);
      return;
    }

    // Android / Chrome: capture the install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful app install
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      // Android / Chrome — trigger the native install dialog
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } else if (isIOS) {
      // iOS — show manual share-sheet instructions
      setShowIOSInstructions(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  // Don't render if already installed, dismissed, or not eligible
  if (isInstalled || dismissed || (!installPrompt && !isIOS)) return null;

  return (
    <>
      {/* Floating Install Banner */}
      <div
        id="pwa-install-banner"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(21, 101, 192, 0.45)',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'inherit',
          maxWidth: '90vw',
          whiteSpace: 'nowrap',
          animation: 'pwa-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <style>{`
          @keyframes pwa-slide-up {
            from { opacity: 0; transform: translateX(-50%) translateY(24px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          #pwa-install-btn:hover { background: rgba(255,255,255,0.25) !important; }
          #pwa-dismiss-btn:hover { background: rgba(255,255,255,0.15) !important; }
        `}</style>

        {/* App icon */}
        <img
          src="/icons/icon-192.png"
          alt="TutorTrack"
          style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}
        />

        <span>Install <strong>TutorTrack</strong> as an app</span>

        <button
          id="pwa-install-btn"
          onClick={handleInstall}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.2)',
            border: '1.5px solid rgba(255,255,255,0.5)',
            color: '#fff',
            borderRadius: 10,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.2s',
          }}
        >
          {isIOS ? <Share size={14} /> : <Download size={14} />}
          {isIOS ? 'How?' : 'Install'}
        </button>

        <button
          id="pwa-dismiss-btn"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 6,
            transition: 'background 0.2s',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div
          id="pwa-ios-modal-overlay"
          onClick={() => setShowIOSInstructions(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 16px 24px',
            animation: 'pwa-fade-in 0.2s ease',
          }}
        >
          <style>{`
            @keyframes pwa-fade-in {
              from { opacity: 0; } to { opacity: 1; }
            }
            @keyframes pwa-sheet-up {
              from { transform: translateY(40px); opacity: 0; }
              to   { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '28px 24px',
              width: '100%',
              maxWidth: 400,
              boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
              animation: 'pwa-sheet-up 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <img src="/icons/icon-192.png" alt="TutorTrack" style={{ width: 48, height: 48, borderRadius: 12 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#1a1a1a' }}>Add TutorTrack to Home Screen</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Follow these steps in Safari</div>
              </div>
            </div>

            <ol style={{ paddingLeft: 20, margin: 0, color: '#333', fontSize: 15, lineHeight: 1.8 }}>
              <li>Tap the <strong>Share</strong> button <span style={{ fontSize: 18 }}>⬆</span> at the bottom of Safari</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>"Add"</strong> in the top-right corner</li>
            </ol>

            <button
              onClick={() => setShowIOSInstructions(false)}
              style={{
                marginTop: 24,
                width: '100%',
                background: '#1565C0',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '13px 0',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
