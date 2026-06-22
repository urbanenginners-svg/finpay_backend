import { resource } from "src/utils/constants/resource";
import { PermissionEnum } from "src/utils/enums/permission.enum";
import { RoleSlugEnum } from "src/utils/enums/role-slug.enum";

export { RoleSlugEnum };

const actions = [
    PermissionEnum.WRITE,
    PermissionEnum.READ,
    PermissionEnum.UPDATE,
    PermissionEnum.DELETE,
];

const allSlugs = (res: string) =>
    actions.map((action) => `${res}:${action}`);

const meReadUpdate = [
    `${resource.Me}:${PermissionEnum.READ}`,
    `${resource.Me}:${PermissionEnum.UPDATE}`,
];

export const roles = [
    {
        name: 'Super Admin',
        slug: RoleSlugEnum.SUPER_ADMIN,
        description: 'Full access to all platform resources',
        permissions: [
            ...allSlugs(resource.Me),
            ...allSlugs(resource.User),
            ...allSlugs(resource.Role),
            ...allSlugs(resource.Permission),
            ...allSlugs(resource.File),
            ...allSlugs(resource.Enquiry),
        ],
    },
    {
        name: 'Admin',
        slug: RoleSlugEnum.ADMIN,
        description: 'Manage users, roles, and files',
        permissions: [
            ...meReadUpdate,
            ...allSlugs(resource.User),
            `${resource.Role}:${PermissionEnum.READ}`,
            ...allSlugs(resource.File),
            ...allSlugs(resource.Enquiry),
        ],
    },
    {
        name: 'Customer',
        slug: RoleSlugEnum.CUSTOMER,
        description: 'End-user with profile and file access',
        permissions: [
            ...meReadUpdate,
            `${resource.File}:${PermissionEnum.WRITE}`,
            `${resource.File}:${PermissionEnum.READ}`,
        ],
    },
    {
        name: 'Agent',
        slug: RoleSlugEnum.AGENT,
        description: 'FinPay partner agent requiring admin verification',
        permissions: [
            ...meReadUpdate,
            `${resource.File}:${PermissionEnum.WRITE}`,
            `${resource.File}:${PermissionEnum.READ}`,
        ],
    },
];
