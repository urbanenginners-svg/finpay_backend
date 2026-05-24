import { PermissionEnum } from "src/utils/enums/permission.enum";
import { AppAbility } from "./types";
import { HttpStatus, SetMetadata } from "@nestjs/common";
import { CHECK_POLICIES_KEY } from "./casl-policies.guard";
import { LoggedException } from "src/utils/exceptions/logged-exception";

interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

type PolicyHandlerCallback = (ability: AppAbility) => boolean;
export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);

export const CheckActionPolicy = (action: PermissionEnum, resource: string) => {
  return CheckPolicies((ability: AppAbility) => {
    const isAllowed = ability.can(action, resource);
    if (!isAllowed) {
      throw new LoggedException(
        `You are not authorized to perform ${action} action on ${resource}.`,
        HttpStatus.FORBIDDEN,
        true,
        // 'err203'
      );
    }
    return isAllowed;
  });
};
