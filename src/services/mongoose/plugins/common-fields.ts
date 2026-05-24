import { v4 as uuidv4 } from 'uuid';
import type { FindOneAndUpdateOptions } from 'mongodb';
import { Schema } from 'mongoose';
import { prefixes } from '../prefixes';
import { referenceNumberCodes } from '../reference-number-codes';

const SEQUENCE_COLLECTION = 'human_id_sequences';

function formatReferenceNumber(code: string, seq: number): string {
  return `${code}-${String(seq).padStart(3, '0')}`;
}

/**
 * Setup common fields that are available on every model
 * options:
 * name: Mongoose model / class name (must exist in prefixes and referenceNumberCodes)
 */

export default function commonFieldsPlugin(schema: Schema, options: { name: string }) {
  schema.add({
    _id: {
      type: String,
      default: function genId() {
        return prefixes[options.name] + '::' + uuidv4();
      },
    },
    referenceNumber: {
      type: String,
      required: false,
      immutable: true,
    },
  });

  schema.index({ referenceNumber: 1 }, { unique: true, sparse: true });

  schema.pre('save', async function assignReferenceNumber() {
    if (!this.isNew || this.referenceNumber) return;

    const modelKey = options.name;
    const code = referenceNumberCodes[modelKey];
    if (!code) {
      throw new Error(
        `referenceNumberCodes missing entry for model "${modelKey}". ` +
          'Add it in src/services/mongoose/reference-number-codes.ts',
      );
    }

    const nativeDb = this.db.db;
    if (!nativeDb) {
      throw new Error(
        `MongoDB connection not ready while assigning referenceNumber for "${modelKey}"`,
      );
    }

    const coll = nativeDb.collection<{ _id: string; seq: number }>(
      SEQUENCE_COLLECTION,
    );

    const findOpts: FindOneAndUpdateOptions = {
      upsert: true,
      returnDocument: 'after',
    };
    const session = this.$session();
    if (session) {
      findOpts.session = session as FindOneAndUpdateOptions['session'];
    }

    const updated = await coll.findOneAndUpdate(
      { _id: modelKey },
      { $inc: { seq: 1 } },
      findOpts,
    );

    const seq =
      updated && typeof updated === 'object' && 'seq' in updated
        ? (updated as { seq: number }).seq
        : null;

    if (seq === null || seq === undefined || Number.isNaN(seq)) {
      throw new Error(
        `Could not allocate reference number sequence for model "${modelKey}"`,
      );
    }

    this.set('referenceNumber', formatReferenceNumber(code, seq));
  });

  schema.set('toJSON', {
    transform: (doc, ret) => {
      delete ret.__v; // Remove the version key
      delete ret.keywords; // Remove keywords used for db search
    },
  });

  schema.set('timestamps', true);
}
