import { Injectable, Logger } from '@nestjs/common';

import { PrithviExchangeService } from 'src/services/prithvi-exchange';

export interface PanVerificationResult {
  verified: boolean;
  verificationId: string;
  provider: string;
  message: string;
  maskedPan: string;
  registeredName?: string;
}

@Injectable()
export class PanVerificationService {
  private readonly logger = new Logger(PanVerificationService.name);

  constructor(private readonly prithviExchange: PrithviExchangeService) {}

  async verify(params: {
    panCardNumber: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    dateOfBirth?: string;
  }): Promise<PanVerificationResult> {
    const panCardNumber = params.panCardNumber.toUpperCase();
    const maskedPan = `XXXXX${panCardNumber.slice(5, 9)}${panCardNumber.slice(-1)}`;
    const name =
      params.name?.trim() ||
      [params.firstName, params.lastName].filter(Boolean).join(' ').trim();

    if (!name) {
      return {
        verified: false,
        verificationId: '',
        provider: 'prithvi-exchange',
        message:
          'Applicant name is required for PAN verification. Please complete your personal details first.',
        maskedPan,
      };
    }

    this.logger.log(
      `PAN verification requested for panNumber=${panCardNumber} name="${name}"`,
    );

    const result = await this.prithviExchange.verifyPanNumber({
      panNumber: panCardNumber,
      name,
    });

    const verified = result.status === 'VERIFIED';

    if (verified) {
      this.logger.log(
        `PAN verification succeeded: panNumber=${result.panNumber} registeredName=${result.registered_name ?? result.name}`,
      );
    } else {
      this.logger.warn(
        `PAN verification failed: panNumber=${panCardNumber} status=${result.status}`,
      );
    }

    return {
      verified,
      verificationId: result.panNumber || panCardNumber,
      provider: this.prithviExchange.isActive
        ? 'prithvi-exchange'
        : 'prithvi-exchange-dry-run',
      message: verified
        ? 'PAN verified successfully'
        : 'PAN verification failed. Please check your PAN number and name. If your name is incorrect, go back and edit your personal details.',
      maskedPan,
      registeredName: result.registered_name,
    };
  }
}
