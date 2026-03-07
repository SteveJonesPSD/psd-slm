-- Extra Weeks & Allowed Schedule Weeks
-- 39-week calendars have 3 "extra" weeks that are scheduled but don't
-- participate in the 4-week rolling cycle. Contract types define which
-- schedule lengths (36/39) they support.

-- ============================================================
-- Add is_extra to visit_calendar_weeks
-- ============================================================
ALTER TABLE visit_calendar_weeks
    ADD COLUMN is_extra BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN visit_calendar_weeks.is_extra IS 'Extra weeks are scheduled (visits generated for all slots) but do not participate in the 4-week cycle rotation. Used in 39-week calendars.';

-- ============================================================
-- Add allowed_schedule_weeks to contract_types
-- ============================================================
ALTER TABLE contract_types
    ADD COLUMN allowed_schedule_weeks INTEGER[] NOT NULL DEFAULT '{36,39}';

COMMENT ON COLUMN contract_types.allowed_schedule_weeks IS 'Which calendar schedule lengths (e.g. 36, 39) this contract type can be used with. Filters available types when a calendar is assigned to a contract.';

-- ============================================================
-- Set defaults for existing ProFlex types
-- ProFlex 1-3: 36-week only. ProFlex 4: both 36 and 39.
-- ============================================================
UPDATE contract_types SET allowed_schedule_weeks = '{36}'
WHERE code IN ('proflex_1', 'proflex_2', 'proflex_3');

UPDATE contract_types SET allowed_schedule_weeks = '{36,39}'
WHERE code = 'proflex_4';
