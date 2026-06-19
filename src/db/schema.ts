import {
  pgTable, pgEnum, uuid, varchar, integer, text,
  decimal, timestamp, unique, index, type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export * from './auth-schema'
import { user } from './auth-schema'

export const abOrganizations = pgTable('ab_organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const abMemberships = pgTable('ab_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => abOrganizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique('ab_memberships_user_org_unique').on(t.userId, t.orgId),
])

export const experimentStatusEnum = pgEnum('ab_experiment_status', [
  'active', 'paused', 'finished',
])

export const abExperiments = pgTable('ab_experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => abOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  status: experimentStatusEnum('status').default('active').notNull(),
  cookieDays: integer('cookie_days').default(30).notNull(),
  checkoutType: varchar('checkout_type', { length: 20 }).notNull().default('kiwify'),
  winnerVariantId: uuid('winner_variant_id').references((): AnyPgColumn => abVariants.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
}, (t) => [
  unique('ab_exp_slug_org_unique').on(t.orgId, t.slug),
  index('ab_exp_org_idx').on(t.orgId),
])

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

export const abSessions = pgTable('ab_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => abVariants.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }).notNull(),
  isNewVisitor: varchar('is_new_visitor', { length: 1 }).notNull().default('1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ab_sessions_exp_idx').on(t.experimentId, t.createdAt),
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
  externalOrderId: varchar('external_order_id', { length: 255 }).notNull(),
  source: varchar('source', { length: 20 }).notNull().default('kiwify'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ab_conv_exp_idx').on(t.experimentId, t.variantId),
  unique('ab_conversions_external_order_id_source_unique').on(t.externalOrderId, t.source),
])

// Relations
export const experimentsRelations = relations(abExperiments, ({ many, one }) => ({
  org: one(abOrganizations, {
    fields: [abExperiments.orgId],
    references: [abOrganizations.id],
  }),
  variants: many(abVariants, { relationName: 'variants' }),
  winner: one(abVariants, {
    fields: [abExperiments.winnerVariantId],
    references: [abVariants.id],
    relationName: 'winner',
  }),
}))

export const organizationsRelations = relations(abOrganizations, ({ many }) => ({
  memberships: many(abMemberships),
  experiments: many(abExperiments),
}))

export const membershipsRelations = relations(abMemberships, ({ one }) => ({
  org: one(abOrganizations, {
    fields: [abMemberships.orgId],
    references: [abOrganizations.id],
  }),
}))

export const variantsRelations = relations(abVariants, ({ one, many }) => ({
  experiment: one(abExperiments, {
    fields: [abVariants.experimentId],
    references: [abExperiments.id],
    relationName: 'variants',
  }),
  visits: many(abVisits),
  conversions: many(abConversions),
  wonExperiments: many(abExperiments, { relationName: 'winner' }),
}))

export const sessionsRelations = relations(abSessions, ({ one }) => ({
  experiment: one(abExperiments, { fields: [abSessions.experimentId], references: [abExperiments.id] }),
  variant: one(abVariants, { fields: [abSessions.variantId], references: [abVariants.id] }),
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
export type Organization = typeof abOrganizations.$inferSelect
export type Membership = typeof abMemberships.$inferSelect
export type Session = typeof abSessions.$inferSelect
