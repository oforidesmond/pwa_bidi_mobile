import api from './index';

/** Staff login: backend expects `identifier` (email or phone), not `email`. */
export const login = async (identifier: string, password: string) => {
  const response = await api.post('/auth/login', { identifier, password });
  return response.data;
};

export const validateToken = async () => {
  const response = await api.get('/auth/validate');
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/auth/profile');
  return response.data;
};

export const logout = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

/** Normalize phone to digits for OTP request/verify. */
export function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

export const requestDriverOtp = async (phone: string) => {
  const response = await api.post('/auth/driver/otp/request', {
    phone: normalizePhone(phone),
  });
  return response.data as {
    success: boolean;
    message?: string;
    expiresAt?: string;
    debugCode?: string;
  };
};

export const verifyDriverOtp = async (phone: string, code: string) => {
  const response = await api.post('/auth/driver/otp/verify', {
    phone: normalizePhone(phone),
    code: code.trim(),
  });
  return response.data as {
    access_token: string;
    driver: {
      id: string;
      phone?: string;
      firstName?: string | null;
      lastName?: string | null;
      ownerType?: 'DRIVER';
      needsPin?: boolean;
      needsProfile?: boolean;
    };
  };
};
