import {
  pgTable, pgEnum, uuid, varchar, integer,
  decimal, timestamp, unique, index, type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const experimentStatusEnum = pgEnum('ab_experiment_status', [
  'active', 'paused', 'finished',
])

export const abExperiments = pgTable('ab_experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: experimentStatusEnum('status').default('active').notNull(),
  cookieDays: integer('cookie_days').default(30).notNull(),
  winnerVariantId: uuid('winner_variant_id').references((): AnyPgColumn => abVariants.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
})

export const abVariants = pgTable('ab_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 5 }).notNull(),   // A, B, C, D, E
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  weight: integer('weight').notNull(),                 // 0–100, sum per experiment = 100
  color: varchar('color', { length: 7 }).notNull(),   // #hex
})

export const abVisits = pgTable('ab_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => abVariants.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique('ab_visits_exp_visitor_unique').on(t.experimentId, t.visitorId),
])

export const abConversions = pgTable('ab_conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => abVariants.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }),
  kiwifyOrderId: varchar('kiwify_order_id', { length: 255 }).notNull().unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ab_conv_exp_idx').on(t.experimentId, t.variantId),
])

// Relations
export const experimentsRelations = relations(abExperiments, ({ many, one }) => ({
  variants: many(abVariants),
  winner: one(abVariants, {
    fields: [abExperiments.winnerVariantId],
    references: [abVariants.id],
    relationName: 'winner',
  }),
}))

export const variantsRelations = relations(abVariants, ({ one, many }) => ({
  experiment: one(abExperiments, {
    fields: [abVariants.experimentId],
    references: [abExperiments.id],
  }),
  visits: many(abVisits),
  conversions: many(abConversions),
  wonExperiments: many(abExperiments, { relationName: 'winner' }),
}))

export const visitsRelations = relations(abVisits, ({ one }) => ({
  experiment: one(abExperiments, { fields: [abVisits.experimentId], references: [abExperiments.id] }),
  variant: one(abVariants, { fields: [abVisits.variantId], references: [abVariants.id] }),
}))

export const conversionsRelations = relations(abConversions, ({ one }) => ({
  experiment: one(abExperiments, { fields: [abConversions.experimentId], references: [abExperiments.id] }),
  variant: one(abVariants, { fields: [abConversions.variantId], references: [abVariants.id] }),
}))

export type Experiment = typeof abExperiments.$inferSelect
export type Variant = typeof abVariants.$inferSelect
export type Visit = typeof abVisits.$inferSelect
export type Conversion = typeof abConversions.$inferSelect
