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
  AGENT_APPROVED: 'agent_approved',
  AGENT_REJECTED: 'agent_rejected',
  AGENT_DOCUMENT_UPDATE: 'agent_document_update',
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
    'Hi {name}, your FinPay order {order} documents are verified. Pay here: {link}',
  variableKeys: ['name', 'order', 'link'],
};

const agentApproved: SmsTemplateDefinition = {
  bodyTemplate:
    'Hi {name}, your FinPay agent account is approved. You can now sign in and start partnering with us.',
  variableKeys: ['name'],
};

const agentRejected: SmsTemplateDefinition = {
  bodyTemplate:
    'Hi {name}, your FinPay agent registration was not approved. Please check your email for details.',
  variableKeys: ['name'],
};

const agentDocumentUpdate: SmsTemplateDefinition = {
  bodyTemplate:
    'Hi {name}, FinPay needs document updates for your agent registration. Please check your email and upload them.',
  variableKeys: ['name'],
};

/** All SMS message templates. Add new templates here (and a key in {@link SMS_TEMPLATE_KEYS}). */
export const smsTemplateRegistry: SmsTemplateRegistry = {
  [SMS_TEMPLATE_KEYS.CUSTOMER_OTP]: customerOtp,
  [SMS_TEMPLATE_KEYS.ENQUIRY_ADVISOR_ALERT]: enquiryAdvisorAlert,
  [SMS_TEMPLATE_KEYS.FOREX_ORDER_APPROVED]: forexOrderApproved,
  [SMS_TEMPLATE_KEYS.AGENT_APPROVED]: agentApproved,
  [SMS_TEMPLATE_KEYS.AGENT_REJECTED]: agentRejected,
  [SMS_TEMPLATE_KEYS.AGENT_DOCUMENT_UPDATE]: agentDocumentUpdate,
};
