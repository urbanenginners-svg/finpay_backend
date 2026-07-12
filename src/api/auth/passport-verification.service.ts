import { Injectable, Logger } from '@nestjs/common';

import { PrithviLeadSystemService } from 'src/services/prithvi-lead-system';

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

    const verified = result.success;

    if (verified) {
      this.logger.log(
        `Passport verification succeeded: verificationId=${result.verificationId} passportNumber=${result.passport_number}`,
      );
    } else {
      this.logger.warn(
        `Passport verification failed: fileNumber=${fileNumber} verificationId=${result.verificationId}`,
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
      passportNumber: result.passport_number || undefined,
      verifiedName: result.name_provided,
    };
  }
}
