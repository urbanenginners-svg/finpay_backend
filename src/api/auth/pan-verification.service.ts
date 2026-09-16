import { Injectable, Logger } from '@nestjs/common';

import { PrithviLeadSystemService } from 'src/services/prithvi-lead-system';
import { isPanNameMatch } from 'src/utils/helpers/pan-name.helper';

export interface PanVerificationResult {
  verified: boolean;
  verificationId: string;
  provider: string;
  message: string;
  maskedPan: string;
  registeredName?: string;
  nameProvided?: string;
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

    const registeredName = (result.registered_name || '').trim();
    const nameProvided = (result.name_provided || name).trim();
    const panExists = result.success === true;
    const nameMatches =
      panExists &&
      !!registeredName &&
      isPanNameMatch(nameProvided, registeredName);
    const verified = panExists && nameMatches;

    if (verified) {
      this.logger.log(
        `PAN verification succeeded: verificationId=${result.verificationId} nameProvided="${nameProvided}" registeredName="${registeredName}"`,
      );
    } else if (panExists && !nameMatches) {
      this.logger.warn(
        `PAN number valid but name mismatch: panNumber=${panCardNumber} verificationId=${result.verificationId} nameProvided="${nameProvided}" registeredName="${registeredName}"`,
      );
    } else {
      this.logger.warn(
        `PAN verification failed: panNumber=${panCardNumber} verificationId=${result.verificationId} nameProvided="${nameProvided}"`,
      );
    }

    let message: string;
    if (verified) {
      message = 'PAN verified successfully';
    } else if (panExists && !nameMatches) {
      message =
        'PAN number is valid but the name does not match the name registered on the PAN. Please check the name and try again.';
    } else {
      message =
        'PAN verification failed. Please check your PAN number and name. If your name is incorrect, go back and edit your personal details.';
    }

    return {
      verified,
      verificationId: String(result.verificationId || panCardNumber),
      provider: this.prithviLeadSystem.isActive
        ? 'prithvi-lead-system'
        : 'prithvi-lead-system-dry-run',
      message,
      maskedPan,
      registeredName: registeredName || undefined,
      nameProvided: nameProvided || undefined,
    };
  }
}
