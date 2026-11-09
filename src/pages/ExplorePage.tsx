import { useBidiTheme } from '@/context/ThemeContext';

export default function ExplorePage() {
  const { tokens } = useBidiTheme();
  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        <p style={{ color: tokens.textPrimary, fontSize: 18, fontWeight: 600 }}>
          Admin tools are on the web console.
        </p>
      </div>
    </div>
  );
}
