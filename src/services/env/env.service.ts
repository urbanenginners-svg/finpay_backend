import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, IsEnum, IsOptional } from 'class-validator';

enum Environment {
  development = 'development',
  production = 'production',
  staging = 'staging',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsString()
  MONGO_CONNECTION_STRING: string;

  @IsOptional()
  @IsString()
  MASTER_KEY: string;

  @IsString()
  JWT_SECRET: string;

  //   @IsString()
  //   CTRL_SENDGRID_KEY: string;

  // @IsString()
  // AUTH_NET_LOGIN_ID: string;

  // @IsString()
  // AUTH_NET_TRANSACTION_KEY: string;

  // @IsString()
  // AUTH_NET_ENVIRONMENT: string;

  @IsOptional()
  @IsString()
  SENTRY_DSN: string;

  @IsOptional()
  @IsString()
  PORT: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_S3_BUCKET: string;

  @IsOptional()
  @IsString()
  AWS_REGION: string;

  @IsOptional()
  @IsString()
  AWS_SES_REGION: string;

  @IsOptional()
  @IsString()
  AWS_SES_FROM_EMAIL: string;

  /**
   * Minimum order subtotal (in ₹) to qualify for free delivery.
   * Defaults to 200 if not set.
   */
  @IsOptional()
  @IsString()
  FREE_DELIVERY_MINIMUM: string;

  /**
   * Flat delivery fee (in ₹) charged when subtotal is below FREE_DELIVERY_MINIMUM.
   * Defaults to 30 if not set.
   */
  @IsOptional()
  @IsString()
  DELIVERY_FEE: string;

  /**
   * Threshold used to determine product variant availability.
   * If (availableCount - reservedCount) < this value, variant will be marked unavailable.
   */
  @IsOptional()
  @IsString()
  INVENTORY_AVAILABILITY_THRESHOLD: string;

  /**
   * Razorpay API Key ID (public key used by the frontend checkout widget).
   */
  @IsOptional()
  @IsString()
  RAZORPAY_KEY_ID: string;

  /**
   * Razorpay API Key Secret (used server-side to sign/verify requests).
   */
  @IsOptional()
  @IsString()
  RAZORPAY_KEY_SECRET: string;

  /**
   * Razorpay Webhook Secret used to verify incoming webhook signatures.
   */
  @IsOptional()
  @IsString()
  RAZORPAY_WEBHOOK_SECRET: string;

  /** Twilio Account SID (from Twilio Console). */
  @IsOptional()
  @IsString()
  TWILIO_ACCOUNT_SID: string;

  /** Twilio Auth Token. */
  @IsOptional()
  @IsString()
  TWILIO_AUTH_TOKEN: string;

  /** Twilio sender phone number in E.164 format (e.g. +14155552671). */
  @IsOptional()
  @IsString()
  TWILIO_PHONE_NUMBER: string;

  /** Set to `"true"` to send SMS via Twilio; any other value skips the API call (dry run). */
  @IsOptional()
  @IsString()
  TWILIO_ACTIVE_MODE: string;

  /**
   * Legacy fallback: used when partner / third-party bases are omitted
   * (same host for both flows).
   */
  @IsOptional()
  @IsString()
  QUEBUSTER_URL: string;

  /** Base URL for partner routes such as `/partner/generateToken` (defaults to QUEBUSTER_URL). */
  @IsOptional()
  @IsString()
  QUEBUSTER_PARTNER_URL: string;

  @IsOptional()
  @IsString()
  QUEBUSTER_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  QUEBUSTER_CLIENT_SECRET: string;

  /** Used in QueueBuster `thirdparty/{chainId}/…` routes. */
  @IsOptional()
  @IsString()
  QUEBUSTER_CHAIN_ID: string;

  @IsOptional()
  @IsString()
  QUEBUSTER_THIRD_PARTY_CHAIN_ID: string;

  /** Comma-separated advisor mobile numbers for service enquiry alerts. */
  @IsOptional()
  @IsString()
  ENQUIRY_ADVISOR_PHONES: string;

  /** Admin email address for new service enquiry notifications. */
  @IsOptional()
  @IsString()
  ENQUIRY_ADMIN_EMAIL: string;

  /** Hostinger / SMTP host (e.g. smtp.hostinger.com). */
  @IsOptional()
  @IsString()
  SMTP_HOST: string;

  /** SMTP port (465 for SSL, 587 for STARTTLS). */
  @IsOptional()
  @IsString()
  SMTP_PORT: string;

  @IsOptional()
  @IsString()
  SMTP_USER: string;

  @IsOptional()
  @IsString()
  SMTP_PASS: string;

  /** From address shown to recipients (e.g. FinPay &lt;noreply@yourdomain.com&gt;). */
  @IsOptional()
  @IsString()
  SMTP_FROM: string;

  /** Set to `"true"` to send emails; any other value skips the SMTP call (dry run). */
  @IsOptional()
  @IsString()
  SMTP_ACTIVE_MODE: string;

  /** Prithvi Exchange API base URL (e.g. https://lead-stage-api…/api). */
  @IsOptional()
  @IsString()
  PRITHVI_BASE_URL: string;

  @IsOptional()
  @IsString()
  PRITHVI_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  PRITHVI_CLIENT_SECRET: string;

  /** Agent UUID assigned by Prithvi for rate lookups. */
  @IsOptional()
  @IsString()
  PRITHVI_AGENT_ID: string;

  /** OAuth scope for client credentials grant. Defaults to "read write". */
  @IsOptional()
  @IsString()
  PRITHVI_SCOPE: string;

  /** Set to `"true"` to call Prithvi APIs; any other value returns dry-run data. */
  @IsOptional()
  @IsString()
  PRITHVI_ACTIVE_MODE: string;

  /** Prithvi Lead System API base URL for PAN / passport verification. */
  @IsOptional()
  @IsString()
  PRITHVI_LEAD_SYSTEM_BASE_URL: string;

  @IsOptional()
  @IsString()
  PRITHVI_LEAD_SYSTEM_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  PRITHVI_LEAD_SYSTEM_CLIENT_SECRET: string;

  /** OAuth scope for client credentials grant. Defaults to "read write". */
  @IsOptional()
  @IsString()
  PRITHVI_LEAD_SYSTEM_SCOPE: string;

  /** Set to `"true"` to call Prithvi Lead System verification APIs; any other value returns dry-run data. */
  @IsOptional()
  @IsString()
  PRITHVI_LEAD_SYSTEM_ACTIVE_MODE: string;

  //   @IsString()
  //   CTRL_FRONTEND_URL: string;
}

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService<EnvironmentVariables>) { }

  get isDevelopment(): boolean {
    return this.configService.get('NODE_ENV') === Environment.development;
  }

  get isProduction(): boolean {
    return this.configService.get('NODE_ENV') === Environment.production;
  }

  get(variable: keyof EnvironmentVariables) {
    return this.configService.get(variable, { infer: true });
  }
}
