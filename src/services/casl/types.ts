import { MongoAbility } from "@casl/ability";
import { PermissionEnum } from "src/utils/enums/permission.enum";

export type AppAbility = MongoAbility<[PermissionEnum, string]>;
