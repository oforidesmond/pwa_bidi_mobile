export function getBidiLogo(
  scheme: 'light' | 'dark',
  size: 'default' | 'large' = 'default',
): string {
  if (size === 'large') {
    return scheme === 'dark' ? '/bidi-logo-dark-large.png' : '/bidi-logo-light-large.png';
  }
  return scheme === 'dark' ? '/bidi-logo-dark.png' : '/bidi-logo-light.png';
}
