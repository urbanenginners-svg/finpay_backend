import { Injectable, Logger } from '@nestjs/common';

import { PrithviExchangeService } from 'src/services/prithvi-exchange';

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

  constructor(private readonly prithviExchange: PrithviExchangeService) {}

  async verify(params: {
    fileNumber: string;
    name: string;
    dob: string;
  }): Promise<PassportVerificationResult> {
    const { fileNumber, name, dob } = params;

    this.logger.log(
      `Passport verification requested for fileNumber=${fileNumber} name="${name}" dob=${dob}`,
    );

    const result = await this.prithviExchange.verifyPassport({
      fileNumber,
      name,
      dob,
    });

    const verified = result.status === 'VERIFIED';

    if (verified) {
      this.logger.log(
        `Passport verification succeeded: passportNumber=${result.passport_number}`,
      );
    } else {
      this.logger.warn(
        `Passport verification failed: fileNumber=${fileNumber} status=${result.status}`,
      );
    }

    return {
      verified,
      verificationId: result.passport_number || fileNumber,
      provider: this.prithviExchange.isActive
        ? 'prithvi-exchange'
        : 'prithvi-exchange-dry-run',
      message: verified
        ? 'Passport verified successfully'
        : 'Passport verification failed. Please check your passport file number, name, and date of birth. If your name is incorrect, go back and edit your personal details.',
      passportNumber: result.passport_number || undefined,
      verifiedName: result.name,
    };
  }
}
