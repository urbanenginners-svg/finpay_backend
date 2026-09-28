import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';

import { User } from 'src/services/mongoose/schemas/user.schema';
import { ACCOUNT_BLOCKED_MESSAGE } from 'src/utils/constants/account-block';

/**
 * Rejects a login or an authenticated request for a blocked account.
 * Uses 401 so the frontend clears the session, like the other login rejections.
 */
export const assertUserNotBlocked = (
  user?: { isBlocked?: boolean } | null,
): void => {
  if (user?.isBlocked) {
    throw new UnauthorizedException(ACCOUNT_BLOCKED_MESSAGE);
  }
};

/** Every stored spelling of one mobile number: 9876543210, 919876543210, +919876543210. */
export const phoneNumberVariants = (phoneNumber: string): string[] => {
  const raw = phoneNumber.trim();
  const digits = raw.replace(/\D/g, '');

  let local = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    local = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    local = digits.slice(1);
  }

  return Array.from(new Set([raw, local, `91${local}`, `+91${local}`]));
};

/**
 * Rejects a mobile number that belongs to a blocked account, so it can't be
 * registered again as a new user or agent. Soft-deleted accounts are included,
 * otherwise deleting a blocked user would free the number.
 */
export const assertPhoneNotBlocked = async (
  userModel: Model<User>,
  phoneNumber?: string | null,
): Promise<void> => {
  if (!phoneNumber?.trim()) {
    return;
  }

  const blocked = await userModel.exists({
    phoneNumber: { $in: phoneNumberVariants(phoneNumber) },
    isBlocked: true,
  });

  if (blocked) {
    throw new ForbiddenException(ACCOUNT_BLOCKED_MESSAGE);
  }
};
