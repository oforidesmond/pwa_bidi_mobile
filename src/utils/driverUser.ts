import type { DriverAuthDriver } from '@/api/auth';
import type { User } from '@/types';

export function driverToUser(
  driver: DriverAuthDriver,
  fallbackPhone?: string,
): User {
  return {
    id: driver.id,
    email: null,
    phone: driver.phone ?? fallbackPhone ?? null,
    firstName: driver.firstName ?? null,
    lastName: driver.lastName ?? null,
    role: null,
    roles: [],
    ownerType: 'DRIVER',
    needsPin: !!driver.needsPin,
    needsProfile: !!driver.needsProfile,
  };
}

export function applyDriverFlags(user: User, driver: DriverAuthDriver): User {
  return {
    ...user,
    firstName: driver.firstName ?? user.firstName,
    lastName: driver.lastName ?? user.lastName,
    phone: driver.phone ?? user.phone,
    needsPin: !!driver.needsPin,
    needsProfile: !!driver.needsProfile,
  };
}
