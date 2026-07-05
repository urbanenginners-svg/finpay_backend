import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PanVerificationResult {
  verified: boolean;
  verificationId: string;
  provider: string;
  message: string;
  maskedPan: string;
}

/**
 * Mock PAN verification provider.
 * Replace this service with a real third-party integration (e.g. NSDL, Protean eGov).
 */
@Injectable()
export class PanVerificationService {
  async verify(params: {
    panCardNumber: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): Promise<PanVerificationResult> {
    const panCardNumber = params.panCardNumber.toUpperCase();
    const verificationId = `PAN-MOCK-${randomUUID()}`;
    const maskedPan = `XXXXX${panCardNumber.slice(5, 9)}${panCardNumber.slice(-1)}`;

    // Mock: fail if PAN numeric portion is 0000 (for testing failure path)
    const verified = !/^[A-Z]{5}0000[A-Z]$/.test(panCardNumber);

    return {
      verified,
      verificationId,
      provider: 'mock-pan-provider',
      message: verified
        ? 'PAN verified successfully (mock provider)'
        : 'PAN verification failed (mock provider)',
      maskedPan,
    };
  }
}
