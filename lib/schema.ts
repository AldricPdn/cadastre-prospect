import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const annotations = pgTable('annotations', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('neutral'),
  owner_name: text('owner_name'),
  phone: text('phone'),
  notes: text('notes'),
  geometry: jsonb('geometry'),
  commune_code: text('commune_code'),
  section: text('section'),
  numero: text('numero'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export type AnnotationRow = typeof annotations.$inferSelect;
export type AnnotationInsert = typeof annotations.$inferInsert;
