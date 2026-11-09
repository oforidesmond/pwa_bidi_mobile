import api from './index';
import { createIdempotencyKey } from './idempotency';

export const buyFuelToken = async (
  data: { amount: number },
  idempotencyKey = createIdempotencyKey(),
) => {
  const response = await api.post(
    '/user/buy-token',
    { amount: data.amount },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return response.data;
};

export const getDriverTransactions = async (status?: 'USED' | 'UNUSED') => {
  const response = await api.get('/user/driver-tokens', {
    params: status ? { status } : {},
  });
  return response.data;
};

/** `userId` is the driver id (JWT sub for drivers). */
export const getDriverMobileNumber = async (userId: string) => {
  const response = await api.get('/user/driver-mobile-number', {
    params: { userId },
  });
  return response.data;
};
