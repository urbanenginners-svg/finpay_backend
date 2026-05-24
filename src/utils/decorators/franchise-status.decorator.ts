import { SetMetadata } from '@nestjs/common';
import { FranchiseRegistrationStatus } from 'src/utils/enums/franchise-registration-status.enum';

export const FRANCHISE_ALLOWED_STATUSES_KEY = 'franchiseAllowedStatuses';

/**
 * Marks a route as accessible to franchise users with the given registration statuses.
 * Without this decorator the FranchiseStatusGuard defaults to APPROVED only.
 *
 * @example
 * @UseGuards(FranchiseStatusGuard)
 * @FranchiseAllowedStatuses(FranchiseRegistrationStatus.DOCUMENTS_PENDING, FranchiseRegistrationStatus.PENDING_APPROVAL)
 * async submitDocuments() { ... }
 */
export const FranchiseAllowedStatuses = (...statuses: FranchiseRegistrationStatus[]) =>
  SetMetadata(FRANCHISE_ALLOWED_STATUSES_KEY, statuses);
