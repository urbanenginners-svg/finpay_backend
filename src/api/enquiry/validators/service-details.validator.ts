import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  FOREX_SERVICE_TYPES,
  INDICATIVE_FX_RATES_INR,
  INSURANCE_COVERAGE,
  INSURANCE_MEMBER_COUNTS,
  INSURANCE_TRAVEL_DESTINATIONS,
  INSURANCE_TRAVEL_DURATIONS,
  INSURANCE_TYPES,
  LOAN_EMPLOYMENT_TYPES,
  LOAN_TYPES,
  MUTUAL_FUND_GOALS,
  MUTUAL_FUND_INVESTMENT_TYPES,
  MUTUAL_FUND_MIN_AMOUNTS,
  REMITTANCE_PURPOSES,
  REMITTANCE_TYPES,
  SUPPORTED_CURRENCIES,
  TRAVEL_BUDGETS,
  TRAVEL_SERVICE_TYPES,
  TRAVELLER_COUNTS,
  SupportedCurrency,
} from '../constants/enquiry.constants';
import { TrimString } from 'src/utils/transforms/trim-string.transform';
import { ServiceEnquiryType } from 'src/utils/enums/service-enquiry-type.enum';

function formatValidationErrors(errors: ReturnType<typeof validateSync>): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...formatValidationErrors(error.children));
    }
  }
  return messages;
}

function assertValidDto<T extends object>(
  dtoClass: new () => T,
  payload: Record<string, unknown>,
): T {
  const instance = plainToInstance(dtoClass, payload, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    throw new BadRequestException(formatValidationErrors(errors));
  }

  return instance;
}

class OutwardRemittanceDetailsDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'currency is required' })
  @IsIn([...SUPPORTED_CURRENCIES], {
    message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency: SupportedCurrency;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'purpose is required' })
  @IsIn([...REMITTANCE_PURPOSES], {
    message: `purpose must be one of: ${REMITTANCE_PURPOSES.join(', ')}`,
  })
  purpose: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'remittanceType is required' })
  @IsIn([...REMITTANCE_TYPES], {
    message: `remittanceType must be one of: ${REMITTANCE_TYPES.join(', ')}`,
  })
  remittanceType: string;
}

class ForeignExchangeDetailsDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'serviceType is required' })
  @IsIn([...FOREX_SERVICE_TYPES], {
    message: `serviceType must be one of: ${FOREX_SERVICE_TYPES.join(', ')}`,
  })
  serviceType: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'currency is required' })
  @IsIn([...SUPPORTED_CURRENCIES], {
    message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency: SupportedCurrency;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'country is required' })
  country: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;
}

class MutualFundDetailsDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'investmentType is required' })
  @IsIn([...MUTUAL_FUND_INVESTMENT_TYPES], {
    message: `investmentType must be one of: ${MUTUAL_FUND_INVESTMENT_TYPES.join(', ')}`,
  })
  investmentType: (typeof MUTUAL_FUND_INVESTMENT_TYPES)[number];

  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number' })
  amount: number;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'goal is required' })
  @IsIn([...MUTUAL_FUND_GOALS], {
    message: `goal must be one of: ${MUTUAL_FUND_GOALS.join(', ')}`,
  })
  goal: string;
}

class TravelDetailsDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'serviceType is required' })
  @IsIn([...TRAVEL_SERVICE_TYPES], {
    message: `serviceType must be one of: ${TRAVEL_SERVICE_TYPES.join(', ')}`,
  })
  serviceType: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'country is required' })
  country: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'travelDate is required' })
  @IsDateString({}, { message: 'travelDate must be a valid ISO date (YYYY-MM-DD)' })
  travelDate: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'travellers is required' })
  @IsIn([...TRAVELLER_COUNTS], {
    message: `travellers must be one of: ${TRAVELLER_COUNTS.join(', ')}`,
  })
  travellers: string;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'budget is required' })
  @IsIn([...TRAVEL_BUDGETS], {
    message: `budget must be one of: ${TRAVEL_BUDGETS.join(', ')}`,
  })
  budget: string;
}

class InsuranceDetailsDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'insuranceType is required' })
  @IsIn([...INSURANCE_TYPES], {
    message: `insuranceType must be one of: ${INSURANCE_TYPES.join(', ')}`,
  })
  insuranceType: (typeof INSURANCE_TYPES)[number];

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'coverage is required' })
  @IsIn([...INSURANCE_COVERAGE], {
    message: `coverage must be one of: ${INSURANCE_COVERAGE.join(', ')}`,
  })
  coverage: string;

  @ValidateIf((o) => o.insuranceType === 'health')
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'members is required when insuranceType is health' })
  @IsIn([...INSURANCE_MEMBER_COUNTS], {
    message: `members must be one of: ${INSURANCE_MEMBER_COUNTS.join(', ')}`,
  })
  members?: string;

  @ValidateIf((o) => o.insuranceType === 'travel')
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'destination is required when insuranceType is travel' })
  @IsIn([...INSURANCE_TRAVEL_DESTINATIONS], {
    message: `destination must be one of: ${INSURANCE_TRAVEL_DESTINATIONS.join(', ')}`,
  })
  destination?: string;

  @ValidateIf((o) => o.insuranceType === 'travel')
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'duration is required when insuranceType is travel' })
  @IsIn([...INSURANCE_TRAVEL_DURATIONS], {
    message: `duration must be one of: ${INSURANCE_TRAVEL_DURATIONS.join(', ')}`,
  })
  duration?: string;
}

class LoanDetailsDto {
  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'loanType is required' })
  @IsIn([...LOAN_TYPES], {
    message: `loanType must be one of: ${LOAN_TYPES.join(', ')}`,
  })
  loanType: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'loanAmount must be a number' })
  @Min(10000, { message: 'loanAmount must be at least 10,000' })
  @Max(10000000, { message: 'loanAmount must not exceed 1,00,00,000' })
  loanAmount: number;

  @TrimString()
  @IsString()
  @IsNotEmpty({ message: 'employment is required' })
  @IsIn([...LOAN_EMPLOYMENT_TYPES], {
    message: `employment must be one of: ${LOAN_EMPLOYMENT_TYPES.join(', ')}`,
  })
  employment: string;
}

function assertFutureOrTodayDate(travelDate: string): void {
  const parsed = new Date(`${travelDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new UnprocessableEntityException('travelDate is not a valid date');
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (parsed < today) {
    throw new UnprocessableEntityException(
      'travelDate must be today or a future date',
    );
  }
}

function assertMutualFundAmount(
  investmentType: (typeof MUTUAL_FUND_INVESTMENT_TYPES)[number],
  amount: number,
): void {
  const minAmount = MUTUAL_FUND_MIN_AMOUNTS[investmentType];
  if (amount < minAmount) {
    throw new UnprocessableEntityException(
      `amount must be at least ${minAmount} for ${investmentType} investments`,
    );
  }
}

export function validateServiceDetails(
  serviceType: ServiceEnquiryType,
  serviceDetails: Record<string, unknown>,
): Record<string, unknown> {
  switch (serviceType) {
    case ServiceEnquiryType.OUTWARD_REMITTANCE:
      return assertValidDto(OutwardRemittanceDetailsDto, serviceDetails) as unknown as Record<
        string,
        unknown
      >;

    case ServiceEnquiryType.FOREIGN_EXCHANGE:
      return assertValidDto(ForeignExchangeDetailsDto, serviceDetails) as unknown as Record<
        string,
        unknown
      >;

    case ServiceEnquiryType.MUTUAL_FUND: {
      const validated = assertValidDto(MutualFundDetailsDto, serviceDetails);
      assertMutualFundAmount(validated.investmentType, validated.amount);
      return validated as unknown as Record<string, unknown>;
    }

    case ServiceEnquiryType.TRAVEL: {
      const validated = assertValidDto(TravelDetailsDto, serviceDetails);
      assertFutureOrTodayDate(validated.travelDate);
      return validated as unknown as Record<string, unknown>;
    }

    case ServiceEnquiryType.INSURANCE:
      return assertValidDto(InsuranceDetailsDto, serviceDetails) as unknown as Record<
        string,
        unknown
      >;

    case ServiceEnquiryType.LOAN:
      return assertValidDto(LoanDetailsDto, serviceDetails) as unknown as Record<
        string,
        unknown
      >;

    default:
      throw new BadRequestException('Invalid serviceType');
  }
}

export function computeFxEstimate(
  currency: SupportedCurrency,
  amount: number,
): { estimatedInrValue: number; fxRateUsed: number } {
  const fxRateUsed = INDICATIVE_FX_RATES_INR[currency];
  const estimatedInrValue = Math.round(amount * fxRateUsed * 100) / 100;
  return { estimatedInrValue, fxRateUsed };
}
