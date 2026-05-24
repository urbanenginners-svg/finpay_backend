import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

import commonFieldsPlugin from "../plugins/common-fields";

@Schema({ collection: "roles" })
export class Role {
  @Prop({
    required: true,
    type: String,
    unique: true,
  })
  _id?: string;

  @Prop({
    required: true,
    unique: true,
    type: String,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    type: String,
  })
  slug: string;

  @Prop({
    required: false,
    type: String,
  })
  description?: string;

  @Prop({
    type: [Types.ObjectId],
    default: [],
    ref: "Permission",
  })
  permissions: Types.ObjectId[]; // Array of permission ids

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive: boolean;
}

export type RoleDocument = Role & Document;

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.plugin(commonFieldsPlugin, { name: Role.name });
