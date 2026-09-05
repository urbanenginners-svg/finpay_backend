import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { User, UserDocument, AgentRegistrationDocuments, AdditionalAgentDocument } from 'src/services/mongoose/schemas/user.schema';
import { Role } from 'src/services/mongoose/schemas/role.schema';
import { RoleSlugEnum } from 'src/utils/enums/role-slug.enum';
import { RegistrationStatusEnum } from 'src/utils/enums/registration-status.enum';
import { PanVerificationStatusEnum } from 'src/utils/enums/pan-verification-status.enum';
import { UserTypeEnum } from 'src/utils/enums/user-type.enum';
import {
  AgentRegistrationDocumentsDto,
  CompleteAgentRegistrationDto,
  CompleteUserRegistrationDto,
  ForgotPasswordDto,
  LoginSendOtpDto,
  LoginVerifyOtpDto,
  PasswordLoginDto,
  RegisterInitDto,
  RegisterVerifyOtpDto,
  ResubmitAgentDocumentsDto,
  ResetPasswordDto,
  UpdateRegistrationStep1Dto,
  VerifyAadhaarDto,
  VerifyPanDto,
  VerifyPassportDto,
  VerifyAgentDto,
} from './dto/register.dto';
import { AadhaarVerificationService } from './aadhaar-verification.service';
import { PanVerificationService } from './pan-verification.service';
import { PassportVerificationService } from './passport-verification.service';
import { FilesService } from '../files/files.service';
import { SmsService } from 'src/services/sms/sms.service';
import { HostingerService } from 'src/services/email/hostinger.service';
import { AppConfigService } from 'src/services/env/env.service';
import { AgentTypeEnum } from 'src/utils/enums/agent-type.enum';
import {
  AGENT_DOCUMENT_FIELDS,
  getAgentTypeLabel,
  getRequiredDocumentKeys,
} from 'src/utils/agent-document-requirements';
import { RequestAgentDocumentUpdateDto } from '../admin/dto/request-agent-document-update.dto';
import { CreateAgentDto } from '../admin/dto/create-agent.dto';

interface RegistrationTokenPayload {
  sub: string;
  scope: 'registration';
  userType: UserTypeEnum;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Role.name) private roleModel: Model<Role>,
    private jwtService: JwtService,
    private aadhaarVerificationService: AadhaarVerificationService,
    private panVerificationService: PanVerificationService,
    private passportVerificationService: PassportVerificationService,
    private filesService: FilesService,
    private readonly smsService: SmsService,
    private readonly hostingerService: HostingerService,
    private readonly config: AppConfigService,
  ) {}

  private roleSlugForUserType(userType: UserTypeEnum): RoleSlugEnum {
    return userType === UserTypeEnum.AGENT
      ? RoleSlugEnum.AGENT
      : RoleSlugEnum.CUSTOMER;
  }

  private async getRoleForUserType(userType: UserTypeEnum) {
    const slug = this.roleSlugForUserType(userType);
    const role = await this.roleModel.findOne({
      slug,
      isActive: { $ne: false },
    });

    if (!role) {
      throw new BadRequestException(`${userType} role is not configured`);
    }

    return role;
  }

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private generateTemporaryPassword(length = 12): string {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = randomBytes(length);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  }

  private displayNameForSms(user: Pick<User, 'firstName' | 'lastName'>): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    const joined = parts.join(' ').trim();
    return joined || 'User';
  }

  private buildOtpSendResponse(phoneNumber: string, otp: string) {
    const response: {
      message: string;
      phoneNumber: string;
      otp?: string;
    } = {
      message: this.smsService.isSmsDeliveryActive()
        ? 'OTP sent successfully'
        : 'OTP generated successfully',
      phoneNumber,
    };

    if (!this.smsService.isSmsDeliveryActive()) {
      response.otp = otp;
    }

    return response;
  }

  private signRegistrationToken(user: UserDocument, userType: UserTypeEnum): string {
    const payload: RegistrationTokenPayload = {
      sub: user._id,
      scope: 'registration',
      userType,
    };

    return this.jwtService.sign(payload, { expiresIn: '2h' });
  }

  private verifyRegistrationToken(token: string): RegistrationTokenPayload {
    try {
      const payload = this.jwtService.verify<RegistrationTokenPayload>(token);

      if (payload.scope !== 'registration') {
        throw new UnauthorizedException('Invalid registration token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Registration session expired. Please start again.');
    }
  }

  private buildAuthResponse(user: UserDocument, role: any) {
    const payload = {
      sub: user._id,
      phoneNumber: user.phoneNumber,
      roleId: role?._id ?? role ?? null,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      userId: user._id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      userType: user.userType,
      registrationStatus: user.registrationStatus,
      role: role ?? null,
    };
  }

  private canLogin(registrationStatus?: RegistrationStatusEnum): boolean {
    return (
      registrationStatus === RegistrationStatusEnum.VERIFIED ||
      registrationStatus === RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION ||
      registrationStatus === RegistrationStatusEnum.PENDING_DOCUMENT_UPDATE
    );
  }

  private assertRegistrationStep(user: UserDocument, expected: RegistrationStatusEnum) {
    if (user.registrationStatus !== expected) {
      throw new BadRequestException(
        `Invalid registration step. Expected ${expected}, got ${user.registrationStatus}`,
      );
    }
  }

  private async linkAgentDocument(
    fileId: string | undefined,
    userId: string,
    label: string,
  ): Promise<string> {
    if (!fileId) {
      throw new BadRequestException(`${label} is required`);
    }

    await this.filesService.findOne(fileId);
    await this.filesService.updateReferenceId(fileId, userId, userId);

    return fileId;
  }

  async initRegistration(dto: RegisterInitDto) {
    const { userType, firstName, lastName, email, phoneNumber, dateOfBirth, password } = dto;
    const normalizedLastName = lastName?.trim() || undefined;

    const existingEmail = await this.userModel.findOne({ email, deletedAt: null });
    if (existingEmail?.registrationStatus === RegistrationStatusEnum.VERIFIED) {
      throw new ConflictException('An account with this email already exists');
    }

    const existingPhone = await this.userModel.findOne({ phoneNumber, deletedAt: null });
    if (
      existingPhone &&
      existingPhone.registrationStatus === RegistrationStatusEnum.VERIFIED
    ) {
      throw new ConflictException('An account with this phone number already exists');
    }

    const role = await this.getRoleForUserType(userType);
    const otp = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 10);

    let user = existingPhone ?? existingEmail;

    if (user) {
      if (user.registrationStatus === RegistrationStatusEnum.VERIFIED) {
        throw new ConflictException('Account already registered. Please login.');
      }

      user.firstName = firstName;
      user.lastName = normalizedLastName;
      user.email = email;
      user.phoneNumber = phoneNumber;
      if (dateOfBirth) {
        user.dateOfBirth = new Date(dateOfBirth);
      }
      user.userType = userType;
      user.role = role._id;
      user.registrationStatus = RegistrationStatusEnum.PENDING_OTP;
      user.password = hashedPassword;
    } else {
      user = new this.userModel({
        firstName,
        lastName: normalizedLastName,
        email,
        phoneNumber,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
        userType,
        role: role._id,
        password: hashedPassword,
        registrationStatus: RegistrationStatusEnum.PENDING_OTP,
        isActive: true,
      });
    }

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await this.smsService.sendOtpSms({
      phoneNumber,
      name: this.displayNameForSms({ firstName, lastName: normalizedLastName }),
      otp,
    });

    const registrationToken = this.signRegistrationToken(user, userType);

    return {
      ...this.buildOtpSendResponse(phoneNumber, otp),
      registrationToken,
    };
  }

  async updateRegistrationStep1(userId: string, dto: UpdateRegistrationStep1Dto) {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null });

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.STEP1_COMPLETE);

    const { firstName, lastName, email, phoneNumber, dateOfBirth, password } = dto;
    const normalizedLastName = lastName?.trim() || undefined;

    const existingEmail = await this.userModel.findOne({
      email,
      deletedAt: null,
      _id: { $ne: userId },
    });
    if (existingEmail?.registrationStatus === RegistrationStatusEnum.VERIFIED) {
      throw new ConflictException('An account with this email already exists');
    }

    const phoneChanged = user.phoneNumber !== phoneNumber;

    if (phoneChanged) {
      const existingPhone = await this.userModel.findOne({
        phoneNumber,
        deletedAt: null,
        _id: { $ne: userId },
      });
      if (existingPhone?.registrationStatus === RegistrationStatusEnum.VERIFIED) {
        throw new ConflictException('An account with this phone number already exists');
      }
    }

    user.firstName = firstName;
    user.lastName = normalizedLastName;
    user.email = email;
    if (dateOfBirth) {
      user.dateOfBirth = new Date(dateOfBirth);
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    if (phoneChanged) {
      user.phoneNumber = phoneNumber;
      const otp = this.generateOtp();
      user.otp = otp;
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      user.registrationStatus = RegistrationStatusEnum.PENDING_OTP;
      await user.save();

      await this.smsService.sendOtpSms({
        phoneNumber,
        name: this.displayNameForSms({ firstName, lastName: normalizedLastName }),
        otp,
      });

      const registrationToken = this.signRegistrationToken(user, user.userType);

      return {
        requiresOtp: true,
        ...this.buildOtpSendResponse(phoneNumber, otp),
        registrationToken,
      };
    }

    user.phoneNumber = phoneNumber;
    await user.save();

    const populatedUser = await this.userModel
      .findOne({ _id: user._id, deletedAt: null })
      .populate('role');

    if (!populatedUser) {
      throw new UnauthorizedException('Registration session not found');
    }

    const registrationToken = this.signRegistrationToken(populatedUser, populatedUser.userType);
    const auth = this.buildAuthResponse(populatedUser, populatedUser.role);

    return {
      requiresOtp: false,
      message: 'Personal details updated successfully',
      registrationToken,
      ...auth,
    };
  }

  async verifyRegistrationOtp(dto: RegisterVerifyOtpDto) {
    const { registrationToken, otp } = dto;
    const payload = this.verifyRegistrationToken(registrationToken);

    const user = await this.userModel
      .findOne({ _id: payload.sub, deletedAt: null })
      .select('+otp');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.PENDING_OTP);

    if (!user.otp || user.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.registrationStatus =
      user.userType === UserTypeEnum.USER
        ? RegistrationStatusEnum.VERIFIED
        : RegistrationStatusEnum.STEP1_COMPLETE;
    await user.save();

    const populatedUser = await this.userModel
      .findOne({ _id: user._id, deletedAt: null })
      .populate('role');

    if (!populatedUser) {
      throw new UnauthorizedException('Registration session not found');
    }

    const newRegistrationToken = this.signRegistrationToken(populatedUser, payload.userType);
    const auth = this.buildAuthResponse(populatedUser, populatedUser.role);

    return {
      message: 'OTP verified successfully',
      registrationToken: newRegistrationToken,
      userType: payload.userType,
      ...auth,
    };
  }

  async verifyAadhaar(dto: VerifyAadhaarDto) {
    return this.aadhaarVerificationService.verify(dto);
  }

  async verifyPan(dto: VerifyPanDto) {
    return this.panVerificationService.verify(dto);
  }

  async verifyPassport(dto: VerifyPassportDto) {
    return this.passportVerificationService.verify(dto);
  }

  private buildApplicantName(user: Pick<User, 'firstName' | 'lastName'>): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  }

  private async verifyPanForUser(
    user: Pick<User, 'firstName' | 'lastName'>,
    panCardNumber: string,
  ) {
    const name = this.buildApplicantName(user);
    if (!name) {
      throw new BadRequestException('Applicant name is required for PAN verification');
    }

    return this.panVerificationService.verify({
      panCardNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      name,
    });
  }

  async completeUserRegistration(userId: string, _dto: CompleteUserRegistrationDto) {
    const user = await this.userModel
      .findOne({ _id: userId, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    if (user.userType !== UserTypeEnum.USER) {
      throw new BadRequestException('Invalid registration type for user KYC');
    }

    if (user.registrationStatus === RegistrationStatusEnum.VERIFIED) {
      return this.buildAuthResponse(user, user.role);
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.STEP1_COMPLETE);

    user.registrationStatus = RegistrationStatusEnum.VERIFIED;
    await user.save();

    return this.buildAuthResponse(user, user.role);
  }

  async completeAgentRegistration(userId: string, dto: CompleteAgentRegistrationDto) {
    const user = await this.userModel
      .findOne({ _id: userId, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    if (user.userType !== UserTypeEnum.AGENT) {
      throw new BadRequestException('Invalid registration type for agent KYC');
    }

    if (user.registrationStatus === RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION) {
      return {
        message:
          'Agent registration already submitted and is pending admin verification.',
        registrationStatus: user.registrationStatus,
        userId: user._id,
        userType: user.userType,
      };
    }

    this.assertRegistrationStep(user, RegistrationStatusEnum.STEP1_COMPLETE);

    if (!dto.documents) {
      throw new BadRequestException('Agent documents are required');
    }

    const requiredKeys = getRequiredDocumentKeys(dto.agentType);
    const fieldLabels = Object.fromEntries(
      AGENT_DOCUMENT_FIELDS[dto.agentType].map((field) => [field.key, field.label]),
    );

    for (const key of requiredKeys) {
      const fileId = dto.documents[key as keyof AgentRegistrationDocumentsDto];
      if (!fileId) {
        throw new BadRequestException(`${fieldLabels[key] ?? key} is required`);
      }
    }

    const linkedDocuments: AgentRegistrationDocuments = {};

    for (const field of AGENT_DOCUMENT_FIELDS[dto.agentType]) {
      const fileId = dto.documents[field.key as keyof AgentRegistrationDocumentsDto];
      if (fileId) {
        linkedDocuments[field.key as keyof AgentRegistrationDocuments] =
          await this.linkAgentDocument(fileId, userId, field.label);
      }
    }

    user.agentDocuments = {
      agentType: dto.agentType,
      documents: linkedDocuments,
    };
    user.registrationStatus = RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION;
    await user.save();

    this.sendAgentRegistrationEmails(user, dto.agentType, linkedDocuments).catch(
      (error) => {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to send agent registration emails for ${user._id}: ${detail}`,
        );
      },
    );

    return {
      message:
        'Agent registration submitted successfully. Your account is pending admin verification.',
      registrationStatus: user.registrationStatus,
      userId: user._id,
      userType: user.userType,
    };
  }

  /**
   * Admin creates a fully registered agent on behalf of someone who cannot self-register.
   * Account is verified immediately; a temporary password is emailed to the agent.
   */
  async createAgentByAdmin(dto: CreateAgentDto, adminUserId: string) {
    const email = dto.email.toLowerCase().trim();
    const phoneNumber = dto.phoneNumber.trim();
    const firstName = dto.firstName.trim();
    const normalizedLastName = dto.lastName?.trim() || undefined;

    const existingEmail = await this.userModel.findOne({ email, deletedAt: null });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    const existingPhone = await this.userModel.findOne({
      phoneNumber,
      deletedAt: null,
    });
    if (existingPhone) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }

    if (!dto.documents) {
      throw new BadRequestException('Agent documents are required');
    }

    const requiredKeys = getRequiredDocumentKeys(dto.agentType);
    const fieldLabels = Object.fromEntries(
      AGENT_DOCUMENT_FIELDS[dto.agentType].map((field) => [field.key, field.label]),
    );

    for (const key of requiredKeys) {
      const fileId = dto.documents[key as keyof AgentRegistrationDocumentsDto];
      if (!fileId) {
        throw new BadRequestException(`${fieldLabels[key] ?? key} is required`);
      }
    }

    const role = await this.getRoleForUserType(UserTypeEnum.AGENT);
    const temporaryPassword =
      dto.password?.trim() || this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = new this.userModel({
      firstName,
      lastName: normalizedLastName,
      email,
      phoneNumber,
      ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
      userType: UserTypeEnum.AGENT,
      role: role._id,
      password: hashedPassword,
      registrationStatus: RegistrationStatusEnum.VERIFIED,
      isActive: true,
      createdBy: adminUserId,
      lastUpdatedBy: adminUserId,
    });

    await user.save();

    const linkedDocuments: AgentRegistrationDocuments = {};

    for (const field of AGENT_DOCUMENT_FIELDS[dto.agentType]) {
      const fileId = dto.documents[field.key as keyof AgentRegistrationDocumentsDto];
      if (fileId) {
        linkedDocuments[field.key as keyof AgentRegistrationDocuments] =
          await this.linkAgentDocument(fileId, user._id, field.label);
      }
    }

    user.agentDocuments = {
      agentType: dto.agentType,
      documents: linkedDocuments,
    };
    await user.save();

    let credentialsEmailSent = false;
    try {
      await this.sendAgentCredentialsEmail(
        user,
        dto.agentType,
        temporaryPassword,
      );
      credentialsEmailSent = true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send agent credentials email for ${user._id}: ${detail}`,
      );
    }

    return {
      message: credentialsEmailSent
        ? 'Agent registered successfully. Login credentials have been emailed to the agent.'
        : 'Agent registered successfully, but the credentials email could not be sent. Ask the agent to use forgot password, or resend credentials later.',
      userId: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      registrationStatus: user.registrationStatus,
      agentType: dto.agentType,
      credentialsEmailSent,
    };
  }

  private async sendAgentCredentialsEmail(
    user: UserDocument,
    agentType: AgentTypeEnum,
    temporaryPassword: string,
  ): Promise<void> {
    if (!user.email?.trim()) {
      throw new BadRequestException('Agent email is required to send credentials');
    }

    const loginUrl = `${this.resolveFrontendUrl()}/login`;

    await this.hostingerService.sendAgentAccountCreatedByAdmin({
      to: user.email.trim(),
      fullName: this.displayNameForSms(user),
      email: user.email.trim(),
      temporaryPassword,
      agentTypeLabel: getAgentTypeLabel(agentType),
      loginUrl,
    });
  }

  private resolveFrontendUrl(): string {
    const configured = this.config.get('FRONTEND_URL')?.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    const nodeEnv = this.config.get('NODE_ENV');
    return nodeEnv === 'production'
      ? 'https://finpayremit.com'
      : 'http://localhost:5173';
  }

  private async sendAgentRegistrationEmails(
    user: UserDocument,
    agentType: AgentTypeEnum,
    documents: AgentRegistrationDocuments,
  ): Promise<void> {
    const fullName = this.displayNameForSms(user);
    const agentTypeLabel = getAgentTypeLabel(agentType);
    const submittedAt = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
    const requiredKeys = getRequiredDocumentKeys(agentType);
    const documentsUploaded = Object.values(documents).filter(Boolean).length;
    const requiredDocumentsUploaded = requiredKeys.filter(
      (key) => Boolean(documents[key as keyof AgentRegistrationDocuments]),
    ).length;
    const reviewUrl = `${this.resolveFrontendUrl()}/admin/agents/${encodeURIComponent(user._id)}`;

    if (user.email?.trim()) {
      await this.hostingerService.sendAgentRegistrationConfirmation({
        to: user.email.trim(),
        fullName,
        agentTypeLabel,
        userId: user._id,
        submittedAt,
      });
    } else {
      this.logger.warn(
        `Skipping agent confirmation email; no email on user ${user._id}`,
      );
    }

    const adminEmail =
      this.config.get('NEW_AGENT_REGISTRATION_EMAIL')?.trim()
      || 'new_agent_registration@gmail.com';

    await this.hostingerService.sendAgentRegistrationAdminNotification({
      to: adminEmail,
      userId: user._id,
      fullName,
      email: user.email ?? '—',
      phoneNumber: user.phoneNumber,
      agentTypeLabel,
      submittedAt,
      documentsUploaded,
      requiredDocumentsUploaded,
      totalRequiredDocuments: requiredKeys.length,
      reviewUrl,
    });
  }

  async requestAgentDocumentUpdate(
    userId: string,
    dto: RequestAgentDocumentUpdateDto,
    adminUserId: string,
  ) {
    const user = await this.userModel
      .findOne({ _id: userId, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.userType !== UserTypeEnum.AGENT) {
      throw new BadRequestException('User is not an agent');
    }

    const allowedStatuses = [
      RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION,
      RegistrationStatusEnum.PENDING_DOCUMENT_UPDATE,
    ];

    if (!allowedStatuses.includes(user.registrationStatus as RegistrationStatusEnum)) {
      throw new BadRequestException(
        'Document updates can only be requested while agent registration is pending',
      );
    }

    const requestedBy = adminUserId?.toString?.() ?? adminUserId;
    if (!requestedBy) {
      throw new BadRequestException('Admin user id is required');
    }

    user.agentDocumentRevisionRequest = {
      requestedAt: new Date(),
      requestedBy,
      message: dto.message?.trim() || undefined,
      items: dto.items.map((item) => ({
        key: item.key,
        label: item.label,
        requestType: item.requestType,
        adminNote: item.adminNote?.trim() || undefined,
      })),
    };
    user.registrationStatus = RegistrationStatusEnum.PENDING_DOCUMENT_UPDATE;
    user.lastUpdatedBy = requestedBy;
    await user.save();

    this.sendAgentDocumentUpdateRequestEmail(user).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send agent document update email for ${user._id}: ${detail}`,
      );
    });

    return {
      message: 'Document update request sent to the agent',
      userId: user._id,
      registrationStatus: user.registrationStatus,
    };
  }

  async resubmitAgentDocuments(userId: string, dto: ResubmitAgentDocumentsDto) {
    const user = await this.userModel
      .findOne({ _id: userId, deletedAt: null })
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('Registration session not found');
    }

    if (user.userType !== UserTypeEnum.AGENT) {
      throw new BadRequestException('Invalid registration type for agent documents');
    }

    if (user.registrationStatus !== RegistrationStatusEnum.PENDING_DOCUMENT_UPDATE) {
      throw new BadRequestException('No pending document update request for this account');
    }

    const revision = user.agentDocumentRevisionRequest;
    if (!revision?.items?.length) {
      throw new BadRequestException('Document revision request is missing or invalid');
    }

    if (!user.agentDocuments?.agentType) {
      throw new BadRequestException('Agent registration documents are missing');
    }

    const linkedDocuments: AgentRegistrationDocuments = {
      ...(user.agentDocuments.documents ?? {}),
    };
    const existingAdditional = [...(user.agentDocuments.additionalDocuments ?? [])];
    const additionalByKey = new Map(
      existingAdditional.map((doc) => [doc.key, doc] as const),
    );

    for (const item of revision.items) {
      const fileId = dto.documents?.[item.key];
      if (!fileId?.trim()) {
        throw new BadRequestException(`${item.label} is required`);
      }

      const linkedFileId = await this.linkAgentDocument(fileId.trim(), userId, item.label);

      if (item.requestType === 'additional') {
        additionalByKey.set(item.key, {
          key: item.key,
          label: item.label,
          fileId: linkedFileId,
          adminNote: item.adminNote,
        });
      } else {
        linkedDocuments[item.key as keyof AgentRegistrationDocuments] = linkedFileId;
      }
    }

    const additionalDocuments: AdditionalAgentDocument[] = Array.from(
      additionalByKey.values(),
    );

    user.agentDocuments = {
      agentType: user.agentDocuments.agentType,
      documents: linkedDocuments,
      additionalDocuments,
    };
    user.agentDocumentRevisionRequest = undefined;
    user.registrationStatus = RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION;
    await user.save();

    return {
      message:
        'Documents submitted successfully. Your registration is pending admin verification again.',
      registrationStatus: user.registrationStatus,
      userId: user._id,
      userType: user.userType,
    };
  }

  private async sendAgentDocumentUpdateRequestEmail(user: UserDocument): Promise<void> {
    const revision = user.agentDocumentRevisionRequest;
    if (!revision?.items?.length || !user.email?.trim()) {
      if (!user.email?.trim()) {
        this.logger.warn(
          `Skipping document update email; no email on user ${user._id}`,
        );
      }
      return;
    }

    const uploadUrl = `${this.resolveFrontendUrl()}/agent/document-update`;

    await this.hostingerService.sendAgentDocumentUpdateRequest({
      to: user.email.trim(),
      fullName: this.displayNameForSms(user),
      message: revision.message,
      uploadUrl,
      items: revision.items.map((item) => ({
        label: item.label,
        requestType: item.requestType,
        adminNote: item.adminNote,
      })),
    });
  }

  async loginWithPassword(dto: PasswordLoginDto) {
    const { identifier, password } = dto;
    const isEmail = identifier.includes('@');

    if (!isEmail && !/^[6-9]\d{9}$/.test(identifier)) {
      throw new BadRequestException('Enter a valid email or 10-digit mobile number');
    }

    const filter = isEmail
      ? { email: identifier.toLowerCase().trim(), deletedAt: null }
      : { phoneNumber: identifier, deletedAt: null };

    const user = await this.userModel.findOne(filter).populate('role');

    if (!user) {
      throw new UnauthorizedException('Invalid email, mobile number, or password');
    }

    if (!this.canLogin(user.registrationStatus)) {
      throw new BadRequestException('Please complete registration before logging in.');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid email, mobile number, or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email, mobile number, or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive. Please contact support.');
    }

    const role = user.role as any;
    if (role && role.isActive === false) {
      throw new UnauthorizedException('Your role is inactive. Please contact support.');
    }

    return this.buildAuthResponse(user, role);
  }

  async loginSendOtp(dto: LoginSendOtpDto) {
    const user = await this.userModel.findOne({
      phoneNumber: dto.phoneNumber,
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number');
    }

    if (!this.canLogin(user.registrationStatus)) {
      throw new BadRequestException(
        'Registration is incomplete. Please complete signup first.',
      );
    }

    const otp = this.generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await this.smsService.sendOtpSms({
      phoneNumber: dto.phoneNumber,
      name: this.displayNameForSms(user),
      otp,
    });

    return this.buildOtpSendResponse(dto.phoneNumber, otp);
  }

  async loginVerifyOtp(dto: LoginVerifyOtpDto) {
    const user = await this.userModel
      .findOne({ phoneNumber: dto.phoneNumber, deletedAt: null })
      .select('+otp')
      .populate('role');

    if (!user) {
      throw new UnauthorizedException('No account found with this phone number');
    }

    if (!this.canLogin(user.registrationStatus)) {
      throw new BadRequestException('Please complete registration before logging in.');
    }

    if (!user.otp || user.otp !== dto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive. Please contact support.');
    }

    const role = user.role as any;
    if (role && role.isActive === false) {
      throw new UnauthorizedException('Your role is inactive. Please contact support.');
    }

    return this.buildAuthResponse(user, role);
  }

  private resolveIdentifierFilter(identifier: string) {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');

    if (!isEmail && !/^[6-9]\d{9}$/.test(trimmed)) {
      throw new BadRequestException('Enter a valid email or 10-digit mobile number');
    }

    return isEmail
      ? { email: trimmed.toLowerCase(), deletedAt: null }
      : { phoneNumber: trimmed, deletedAt: null };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const filter = this.resolveIdentifierFilter(dto.identifier);
    const user = await this.userModel.findOne(filter);

    if (!user) {
      throw new UnauthorizedException('No account found with this email or mobile number');
    }

    if (!this.canLogin(user.registrationStatus)) {
      throw new BadRequestException(
        'Registration is incomplete. Please complete signup first.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive. Please contact support.');
    }

    if (!user.phoneNumber) {
      throw new BadRequestException(
        'No mobile number is linked to this account. Please contact support.',
      );
    }

    const otp = this.generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await this.smsService.sendOtpSms({
      phoneNumber: user.phoneNumber,
      name: this.displayNameForSms(user),
      otp,
    });

    return this.buildOtpSendResponse(user.phoneNumber, otp);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const filter = this.resolveIdentifierFilter(dto.identifier);
    const user = await this.userModel.findOne(filter).select('+otp');

    if (!user) {
      throw new UnauthorizedException('No account found with this email or mobile number');
    }

    if (!this.canLogin(user.registrationStatus)) {
      throw new BadRequestException('Please complete registration before resetting password.');
    }

    if (!user.otp || user.otp !== dto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
      throw new UnauthorizedException('OTP expired');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return {
      message: 'Password reset successfully. You can now sign in with your new password.',
    };
  }

  async verifyAgent(userId: string, dto: VerifyAgentDto, adminUserId: string) {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null }).populate('role');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.userType !== UserTypeEnum.AGENT) {
      throw new BadRequestException('User is not an agent');
    }

    if (user.registrationStatus !== RegistrationStatusEnum.PENDING_ADMIN_VERIFICATION) {
      throw new BadRequestException('Agent is not pending verification');
    }

    if (dto.approved) {
      user.registrationStatus = RegistrationStatusEnum.VERIFIED;
      user.rejectionReason = undefined;
    } else {
      user.registrationStatus = RegistrationStatusEnum.REJECTED;
      user.rejectionReason = dto.rejectionReason ?? 'Rejected by admin';
    }

    user.lastUpdatedBy = adminUserId;
    await user.save();

    return {
      message: dto.approved
        ? 'Agent verified successfully'
        : 'Agent registration rejected',
      userId: user._id,
      registrationStatus: user.registrationStatus,
    };
  }
}
