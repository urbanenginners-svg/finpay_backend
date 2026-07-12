import { Injectable, Logger } from '@nestjs/common';

import { PrithviLeadSystemService } from 'src/services/prithvi-lead-system';
import { PRITHVI_LEAD_SYSTEM_PASSPORT_VALID_STATUS } from 'src/services/prithvi-lead-system/prithvi-lead-system.constants';

export interface PassportVerificationResult {
  verified: boolean;
  verificationId: string;
  provider: string;
  message: string;
  passportNumber?: string;
  verifiedName?: string;
}

@Injectable()
export class PassportVerificationService {
  private readonly logger = new Logger(PassportVerificationService.name);

  constructor(private readonly prithviLeadSystem: PrithviLeadSystemService) {}

  async verify(params: {
    fileNumber: string;
    name: string;
    dob: string;
  }): Promise<PassportVerificationResult> {
    const { fileNumber, name, dob } = params;

    this.logger.log(
      `Passport verification requested for fileNumber=${fileNumber} name="${name}" dob=${dob}`,
    );

    const result = await this.prithviLeadSystem.verifyPassport({
      fileNumber,
      name,
      dob,
    });

    const verified =
      result.status?.toUpperCase() ===
      PRITHVI_LEAD_SYSTEM_PASSPORT_VALID_STATUS;

    if (verified) {
      this.logger.log(
        `Passport verification succeeded: verificationId=${result.verificationId} fileNumber=${result.file_number} status=${result.status}`,
      );
    } else {
      this.logger.warn(
        `Passport verification failed: fileNumber=${fileNumber} verificationId=${result.verificationId} status=${result.status}`,
      );
    }

    return {
      verified,
      verificationId: String(result.verificationId || fileNumber),
      provider: this.prithviLeadSystem.isActive
        ? 'prithvi-lead-system'
        : 'prithvi-lead-system-dry-run',
      message: verified
        ? 'Passport verified successfully'
        : 'Passport verification failed. Please check your passport file number, name, and date of birth. If your name is incorrect, go back and edit your personal details.',
      passportNumber: result.file_number || undefined,
      verifiedName: result.name,
    };
  }
}
