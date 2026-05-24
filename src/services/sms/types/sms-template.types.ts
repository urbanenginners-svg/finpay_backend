/**
 * One DLT-registered SMS layout for Airtel (body uses `{var}` placeholders).
 */
export type SmsTemplateDefinition = {
  dltTemplateId: string;
  sourceAddress: string;
  messageType: string;
  bodyTemplate: string;
  variableKeys: readonly string[];
};

export type SmsTemplateRegistry = Record<string, SmsTemplateDefinition>;
