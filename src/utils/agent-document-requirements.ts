import { AgentTypeEnum } from './enums/agent-type.enum';

export const AGENT_DOCUMENT_FIELDS: Record<
  AgentTypeEnum,
  { key: string; label: string; required: boolean }[]
> = {
  [AgentTypeEnum.INDIVIDUAL]: [
    { key: 'panCard', label: 'PAN Card', required: true },
    {
      key: 'idProof',
      label: 'Aadhaar Card / Passport / Driving License / Voter Id',
      required: true,
    },
    { key: 'photograph', label: 'Photograph', required: false },
    {
      key: 'bankAccountProof',
      label: 'Bank Account Statement / Cancelled Cheque',
      required: true,
    },
    {
      key: 'businessAddressProof',
      label: 'Business/Office Address Proof (Rent Agreement / Udyam Aadhar)',
      required: true,
    },
  ],
  [AgentTypeEnum.PROPRIETORSHIP]: [
    {
      key: 'proprietorPanCard',
      label: 'Proprietor PAN Card / Firm PAN Card',
      required: true,
    },
    {
      key: 'proprietorIdProof',
      label: 'Proprietor Aadhaar Card / Passport / Driving License / Voter Id',
      required: true,
    },
    { key: 'proprietorPhotograph', label: 'Proprietor Photograph', required: false },
    { key: 'gstCertificate', label: 'GST Certificate (If available)', required: false },
    {
      key: 'businessAddressProof',
      label:
        'Business/Office Address Proof (Rent Agreement / Udyam Aadhar / Shop & Establishment Certificate)',
      required: true,
    },
    {
      key: 'firmBankAccountProof',
      label: 'Firm Bank Account Proof / Cancelled Cheque',
      required: true,
    },
  ],
  [AgentTypeEnum.PARTNERSHIP]: [
    { key: 'firmPanCard', label: 'PAN Card of the Firm', required: true },
    {
      key: 'authorisedPartnerIdProof',
      label:
        'Aadhaar Card / Passport / Driving License / Voter Id of the Authorised Partner',
      required: true,
    },
    {
      key: 'authorisedPartnerPhotograph',
      label: 'Photograph of the Authorised Partner',
      required: true,
    },
    { key: 'partnershipDeed', label: 'Partnership Deed', required: true },
    { key: 'gstCertificate', label: 'GST Certificate (If available)', required: false },
    {
      key: 'businessAddressProof',
      label:
        'Business/Office Address Proof (Rent Agreement / Udyam Aadhar / Shop & Establishment Certificate)',
      required: true,
    },
    {
      key: 'firmBankAccountProof',
      label: 'Firm Bank Account Proof / Cancelled Cheque',
      required: true,
    },
    {
      key: 'authorisationLetter',
      label: 'Authorisation Letter for the concerned partner to operate the account',
      required: true,
    },
  ],
  [AgentTypeEnum.PRIVATE_LIMITED]: [
    {
      key: 'certificateOfIncorporation',
      label: 'Certificate of Incorporation (COI)',
      required: true,
    },
    { key: 'companyPanCard', label: 'Company PAN Card', required: true },
    { key: 'gstCertificate', label: 'GST Certificate', required: true },
    { key: 'moaAoa', label: 'Memorandum of Association (MOA) & Articles of Association (AOA)', required: true },
    {
      key: 'businessAddressProof',
      label:
        'Company/Registered Office Address Proof (Rent Agreement / Lease Deed / Udyam Aadhar)',
      required: true,
    },
    {
      key: 'companyBankAccountProof',
      label: 'Company Bank Account Proof / Cancelled Cheque',
      required: true,
    },
    {
      key: 'directorPanCard',
      label: 'PAN Card of the Director/Authorised Signatory',
      required: true,
    },
    {
      key: 'directorIdProof',
      label:
        'Aadhaar Card / Passport / Driving License / Voter Id of the Director/Authorised Signatory',
      required: true,
    },
    {
      key: 'directorPhotograph',
      label: 'Photograph of the Director/Authorised Signatory',
      required: true,
    },
    {
      key: 'boardResolution',
      label: 'Board Resolution / Authorisation Letter for the authorised person',
      required: true,
    },
    {
      key: 'beneficialOwnerDetails',
      label: 'Beneficial Owner / Shareholding details',
      required: true,
    },
  ],
};

export function getRequiredDocumentKeys(agentType: AgentTypeEnum): string[] {
  return AGENT_DOCUMENT_FIELDS[agentType]
    .filter((field) => field.required)
    .map((field) => field.key);
}
