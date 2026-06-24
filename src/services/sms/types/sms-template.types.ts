/** SMS layout with `{var}` placeholders rendered before sending via Twilio. */
export type SmsTemplateDefinition = {
  bodyTemplate: string;
  variableKeys: readonly string[];
};

export type SmsTemplateRegistry = Record<string, SmsTemplateDefinition>;
