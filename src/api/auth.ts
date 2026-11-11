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

export type DriverAuthDriver = {
  id: string;
  phone?: string;
  firstName?: string | null;
  lastName?: string | null;
  ownerType?: 'DRIVER';
  needsPin?: boolean;
  needsProfile?: boolean;
};

export type DriverAuthResponse = {
  access_token: string;
  driver: DriverAuthDriver;
};

export type DriverFlagsResponse = {
  success: boolean;
  driver: DriverAuthDriver;
};

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
  return response.data as DriverAuthResponse;
};

export const loginWithDriverPin = async (phone: string, pin: string) => {
  const response = await api.post('/auth/driver/pin/login', {
    phone: normalizePhone(phone),
    pin: pin.trim(),
  });
  return response.data as DriverAuthResponse;
};

export const setDriverPin = async (body: {
  pin: string;
  confirmPin: string;
  firstName?: string;
  lastName?: string;
}) => {
  const response = await api.post('/auth/driver/pin/set', {
    pin: body.pin.trim(),
    confirmPin: body.confirmPin.trim(),
    ...(body.firstName?.trim() ? { firstName: body.firstName.trim() } : {}),
    ...(body.lastName?.trim() ? { lastName: body.lastName.trim() } : {}),
  });
  return response.data as DriverFlagsResponse;
};

export const completeDriverProfile = async (firstName: string, lastName: string) => {
  const response = await api.post('/auth/driver/profile', {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  });
  return response.data as DriverFlagsResponse;
};

export const requestDriverPinReset = async (phone: string) => {
  const response = await api.post('/auth/driver/pin/forgot/request', {
    phone: normalizePhone(phone),
  });
  return response.data as {
    success: boolean;
    message?: string;
    expiresAt?: string;
    debugCode?: string;
  };
};

export const confirmDriverPinReset = async (body: {
  phone: string;
  code: string;
  newPin: string;
  confirmPin: string;
}) => {
  const response = await api.post('/auth/driver/pin/forgot/confirm', {
    phone: normalizePhone(body.phone),
    code: body.code.trim(),
    newPin: body.newPin.trim(),
    confirmPin: body.confirmPin.trim(),
  });
  return response.data as { success: boolean; message?: string };
};
