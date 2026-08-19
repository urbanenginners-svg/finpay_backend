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
  FOREX_ORDER_APPROVED: 'forex_order_approved',
} as const;

export type SmsTemplateKey =
  (typeof SMS_TEMPLATE_KEYS)[keyof typeof SMS_TEMPLATE_KEYS];

const customerOtp: SmsTemplateDefinition = {
  bodyTemplate:
    'Hi {name}, your FinPay verification code is {otp}. Valid for 10 minutes. Do not share this code with anyone.',
  variableKeys: ['name', 'otp'],
};

const enquiryAdvisorAlert: SmsTemplateDefinition = {
  bodyTemplate:
    'New FinPay enquiry{priority}: {service} from {name} ({mobile}). Ref: {ref}. Please follow up within 2 business hours.',
  variableKeys: ['priority', 'service', 'name', 'mobile', 'ref'],
};

const forexOrderApproved: SmsTemplateDefinition = {
  bodyTemplate:
    'Hi {name}, your FinPay order {order} documents are verified. Please go to Transactions and make payment.',
  variableKeys: ['name', 'order'],
};

/** All SMS message templates. Add new templates here (and a key in {@link SMS_TEMPLATE_KEYS}). */
export const smsTemplateRegistry: SmsTemplateRegistry = {
  [SMS_TEMPLATE_KEYS.CUSTOMER_OTP]: customerOtp,
  [SMS_TEMPLATE_KEYS.ENQUIRY_ADVISOR_ALERT]: enquiryAdvisorAlert,
  [SMS_TEMPLATE_KEYS.FOREX_ORDER_APPROVED]: forexOrderApproved,
};
