import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface AadhaarVerificationResult {
  verified: boolean;
  verificationId: string;
  provider: string;
  message: string;
  maskedAadhaar: string;
}

/**
 * Mock Aadhaar verification provider.
 * Replace this service with a real third-party integration (e.g. DigiLocker, UIDAI partner API).
 */
@Injectable()
export class AadhaarVerificationService {
  async verify(params: {
    aadhaarNumber: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): Promise<AadhaarVerificationResult> {
    const { aadhaarNumber } = params;
    const verificationId = `AADH-MOCK-${randomUUID()}`;
    const maskedAadhaar = `XXXX-XXXX-${aadhaarNumber.slice(-4)}`;

    // Mock: fail if Aadhaar ends with 0000 (for testing failure path)
    const verified = !aadhaarNumber.endsWith('0000');

    return {
      verified,
      verificationId,
      provider: 'mock-aadhaar-provider',
      message: verified
        ? 'Aadhaar verified successfully (mock provider)'
        : 'Aadhaar verification failed (mock provider)',
      maskedAadhaar,
    };
  }
}
