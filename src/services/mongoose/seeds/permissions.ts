import { resource } from "src/utils/constants/resource";
import { PermissionEnum } from "src/utils/enums/permission.enum";

const actions = [
    PermissionEnum.WRITE,
    PermissionEnum.READ,
    PermissionEnum.UPDATE,
    PermissionEnum.DELETE,
] as const;

const resources = [
    resource.Me,
    resource.User,
    resource.Role,
    resource.Permission,
    resource.File,
    resource.Enquiry,
] as const;

export const permissions = resources.flatMap((res) =>
    actions.map((action) => ({
        action,
        resource: res,
        slug: `${res}:${action}`,
    })),
);
