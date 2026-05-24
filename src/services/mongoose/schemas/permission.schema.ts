import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, UpdateQuery } from "mongoose";

import commonFieldsPlugin from "../plugins/common-fields";
import { PermissionEnum } from "src/utils/enums/permission.enum";

export type PermissionDocument = Permission & Document;

@Schema({ collection: "permissions" })
export class Permission {
  @Prop({
    required: true,
    type: String,
    unique: true,
  })
  _id?: string;

  @Prop({
    required: true,
    enum: Object.values(PermissionEnum),
    type: String,
  })
  action: PermissionEnum;

  @Prop({
    required: true,
    type: String,
  })
  slug: string;

  @Prop({
    required: true,
    type: String,
  })
  resource: string;

  @Prop({
    required: false,
    type: String,
  })
  isInstitutionPermission?: boolean;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

PermissionSchema.plugin(commonFieldsPlugin, { name: Permission.name });

// Add pre-save middleware to generate slug before insert and update
PermissionSchema.pre<PermissionDocument>("save", function () {
  if (this.resource && this.action) {
    this.slug = `${this.resource}:${this.action}`
      .toLowerCase()
      .replace(/\s+/g, "-");
  }
});

// Add pre-update middleware to generate slug before update operations
PermissionSchema.pre(["updateOne", "findOneAndUpdate"], function () {
  const update = this.getUpdate() as UpdateQuery<Permission>;
  if (update.resource && update.action) {
    // Generate slug using the same logic as the generateSlug method
    update.slug = `${update.resource}:${update.action}`
      .toLowerCase()
      .replace(/\s+/g, "-");
  }
});
