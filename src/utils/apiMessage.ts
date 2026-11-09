/** Normalize Nest validation / business error payloads for UI copy. */
export function formatApiMessage(message: unknown, fallback = 'Something went wrong'): string {
  if (Array.isArray(message)) return message.filter(Boolean).join('\n') || fallback;
  if (typeof message === 'string' && message.trim()) return message;
  if (message && typeof message === 'object' && 'message' in message) {
    return formatApiMessage((message as { message: unknown }).message, fallback);
  }
  return fallback;
}

export function formatAxiosError(error: unknown, fallback = 'Request failed'): string {
  const ax = error as {
    response?: { status?: number; data?: { message?: unknown } };
    message?: string;
  };
  const status = ax?.response?.status;
  const fromBody = formatApiMessage(ax?.response?.data?.message, '');

  if (status === 503) {
    return (
      fromBody ||
      'Payment service is temporarily unavailable. Please try again in a few minutes.'
    );
  }
  if (status === 401) {
    return fromBody || 'Your session expired. Please sign in again.';
  }
  if (status === 400 && fromBody) {
    return fromBody;
  }

  return fromBody || ax?.message || fallback;
}
