import { useBidiTheme } from '@/context/ThemeContext';

export function AuthLegalFooter() {
  const { tokens } = useBidiTheme();
  const year = new Date().getFullYear();

  return (
    <footer className="bidi-auth-footer" style={{ color: tokens.textTertiary }}>
      © {year} Bidi Group
    </footer>
  );
}
