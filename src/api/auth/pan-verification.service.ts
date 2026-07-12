import { Injectable, Logger } from '@nestjs/common';

import { PrithviLeadSystemService } from 'src/services/prithvi-lead-system';

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

  constructor(private readonly prithviLeadSystem: PrithviLeadSystemService) {}

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
        provider: 'prithvi-lead-system',
        message:
          'Applicant name is required for PAN verification. Please complete your personal details first.',
        maskedPan,
      };
    }

    this.logger.log(
      `PAN verification requested for panNumber=${panCardNumber} name="${name}"`,
    );

    const result = await this.prithviLeadSystem.verifyPanNumber({
      panNumber: panCardNumber,
      name,
    });

    const verified = result.success;

    if (verified) {
      this.logger.log(
        `PAN verification succeeded: verificationId=${result.verificationId} registeredName=${result.registered_name}`,
      );
    } else {
      this.logger.warn(
        `PAN verification failed: panNumber=${panCardNumber} verificationId=${result.verificationId}`,
      );
    }

    return {
      verified,
      verificationId: String(result.verificationId || panCardNumber),
      provider: this.prithviLeadSystem.isActive
        ? 'prithvi-lead-system'
        : 'prithvi-lead-system-dry-run',
      message: verified
        ? 'PAN verified successfully'
        : 'PAN verification failed. Please check your PAN number and name. If your name is incorrect, go back and edit your personal details.',
      maskedPan,
      registeredName: result.registered_name || undefined,
    };
  }
}
