import Dexie, { type Table } from "dexie";
import { DB_NAME } from "@/domain/constants";
import type {
  BreakRecord,
  RuleRecord,
  SecretRecord,
  SettingRecord,
} from "@/domain/types";

export class DontDosDatabase extends Dexie {
  rules!: Table<RuleRecord, string>;
  breaks!: Table<BreakRecord, string>;
  settings!: Table<SettingRecord, string>;
  secrets!: Table<SecretRecord, "deepseek">;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      rules: "id, category, archived, createdAt, updatedAt",
      breaks: "id, ruleId, occurredAt, updatedAt",
      settings: "key",
      secrets: "key",
    });
  }
}

export const db = new DontDosDatabase();
