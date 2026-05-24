import type {
  SmsTemplateDefinition,
  SmsTemplateRegistry,
} from '../types/sms-template.types';

/**
 * Well-known keys for {@link smsTemplateRegistry}. Prefer these over string literals.
 */
export const SMS_TEMPLATE_KEYS = {
  CUSTOMER_OTP: 'customer_otp',
  ENQUIRY_ADVISOR_ALERT: 'enquiry_advisor_alert',
} as const;

export type SmsTemplateKey =
  (typeof SMS_TEMPLATE_KEYS)[keyof typeof SMS_TEMPLATE_KEYS];

const customerOtp: SmsTemplateDefinition = {
  dltTemplateId: '1007271150393582852',
  sourceAddress: 'JVFPLC',
  messageType: 'SERVICE_IMPLICIT',
  bodyTemplate:
    'Hi {name}, Your verification code is {otp}. This is valid for 10 minutes. Do not share this with anyone. Thanks, Team Sbzee',
  variableKeys: ['name', 'otp'],
};

const enquiryAdvisorAlert: SmsTemplateDefinition = {
  dltTemplateId: '1007271150393582852',
  sourceAddress: 'JVFPLC',
  messageType: 'SERVICE_IMPLICIT',
  bodyTemplate:
    'New FinPay enquiry{priority}: {service} from {name} ({mobile}). Ref: {ref}. Please follow up within 2 business hours.',
  variableKeys: ['priority', 'service', 'name', 'mobile', 'ref'],
};

/**
 * All DLT-backed SMS layouts. Add new templates here (and a key in {@link SMS_TEMPLATE_KEYS}).
 */
export const smsTemplateRegistry: SmsTemplateRegistry = {
  [SMS_TEMPLATE_KEYS.CUSTOMER_OTP]: customerOtp,
  [SMS_TEMPLATE_KEYS.ENQUIRY_ADVISOR_ALERT]: enquiryAdvisorAlert,
};
