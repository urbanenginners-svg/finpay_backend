import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';

export const ENQUIRY_SOURCE = 'service-enquiry-hub';

export const SUPPORTED_CURRENCIES = [
  'USD',
  'GBP',
  'EUR',
  'AED',
  'SGD',
  'CAD',
  'AUD',
  'JPY',
  'CHF',
  'NZD',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const REMITTANCE_PURPOSES = [
  'Education Payments',
  'Travel Payments',
  'Medical Payments',
  'Gift Transfer',
  'Family Support / Maintenance',
] as const;

export const REMITTANCE_TYPES = ['Wire Transfer'] as const;

export const FOREX_SERVICE_TYPES = ['exchange', 'travel-card'] as const;

export const MUTUAL_FUND_INVESTMENT_TYPES = ['sip', 'lump-sum'] as const;

export const MUTUAL_FUND_GOALS = [
  'Wealth Creation',
  'Retirement Planning',
  'Child Education',
  'Tax Saving (ELSS)',
  'Short-term Goals',
] as const;

export const TRAVEL_SERVICE_TYPES = ['air-ticket', 'holiday-package'] as const;

export const TRAVELLER_COUNTS = ['1', '2', '3', '4', '5', '6', '7+'] as const;

export const TRAVEL_BUDGETS = [
  'Under ₹25,000',
  '₹25,000 – ₹50,000',
  '₹50,000 – ₹1,00,000',
  '₹1,00,000 – ₹2,50,000',
  'Above ₹2,50,000',
] as const;

export const INSURANCE_TYPES = ['health', 'travel'] as const;

export const INSURANCE_COVERAGE = [
  '₹5 Lakh',
  '₹10 Lakh',
  '₹25 Lakh',
  '₹50 Lakh',
  '₹1 Crore',
  'Custom',
] as const;

export const INSURANCE_MEMBER_COUNTS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6+',
] as const;

export const INSURANCE_TRAVEL_DESTINATIONS = [
  'Asia Pacific',
  'Europe',
  'USA & Canada',
  'Worldwide',
] as const;

export const INSURANCE_TRAVEL_DURATIONS = [
  'Up to 1 Week',
  'Up to 2 Weeks',
  'Up to 1 Month',
  'Up to 3 Months',
] as const;

export const LOAN_TYPES = [
  'Personal Loan',
  'Home Loan',
  'Education Loan',
  'Business Loan',
  'Vehicle Loan',
  'Gold Loan',
  'Loan Against Property',
] as const;

export const LOAN_EMPLOYMENT_TYPES = [
  'Salaried',
  'Self-Employed',
  'Self-Employed / Business',
  'Professional',
  'Professional (Doctor, CA, etc.)',
  'NRI',
] as const;

/** Indicative INR rates per 1 unit of foreign currency (updated periodically). */
export const INDICATIVE_FX_RATES_INR: Record<SupportedCurrency, number> = {
  USD: 83.5,
  GBP: 105.2,
  EUR: 90.8,
  AED: 22.75,
  SGD: 62.1,
  CAD: 61.4,
  AUD: 55.3,
  JPY: 0.56,
  CHF: 94.6,
  NZD: 51.2,
};

export const SERVICE_TYPE_LABELS: Record<ServiceEnquiryType, string> = {
  [ServiceEnquiryType.OUTWARD_REMITTANCE]: 'Send Money Abroad',
  [ServiceEnquiryType.FOREIGN_EXCHANGE]: 'Foreign Exchange',
  [ServiceEnquiryType.MUTUAL_FUND]: 'Mutual Fund',
  [ServiceEnquiryType.TRAVEL]: 'Tour & Travel',
  [ServiceEnquiryType.INSURANCE]: 'Insurance',
  [ServiceEnquiryType.LOAN]: 'Loan',
};

export const MUTUAL_FUND_MIN_AMOUNTS: Record<
  (typeof MUTUAL_FUND_INVESTMENT_TYPES)[number],
  number
> = {
  sip: 500,
  'lump-sum': 5000,
};
