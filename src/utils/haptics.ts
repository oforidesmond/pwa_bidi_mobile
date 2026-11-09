/** Soft Vibration API wrappers — no-op when unsupported. */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore
  }
}

export async function hapticSuccess() {
  vibrate([10, 40, 10]);
}

export async function hapticError() {
  vibrate([30, 40, 30]);
}

export async function hapticMedium() {
  vibrate(15);
}

export async function hapticLight() {
  vibrate(8);
}

/** Row tap / light selection feedback. */
export async function hapticSelection() {
  vibrate(6);
}
