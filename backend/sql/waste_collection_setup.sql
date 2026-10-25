-- NagarSetu waste collection workforce and fleet setup.
-- Run after nagarseu_schema.sql. Safe to rerun: roles, workforce, availability,
-- permissions, and vehicles are upserted by stable codes. Existing DEMO-HLD fleet
-- rows are removed because they belong to the retired synthetic test zone.
--
-- Demo credentials for this seed only:
--   Drivers:     Driver@123
--   Supervisors: Supervisor@123
-- Change these passwords before any non-demo deployment.

BEGIN;

INSERT INTO roles (name, description) VALUES
    ('waste_driver', 'Waste collection driver; may view own assignment and operate own trip.'),
    ('waste_supervisor', 'Area waste supervisor; may manage drivers, availability, and fleet assignments in their own area.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
    ('WASTE_VIEW_OWN_ROUTE', 'View own waste collection assignment and route.'),
    ('WASTE_START_TRIP', 'Start or finish an assigned waste collection trip.'),
    ('WASTE_REPORT_LOCATION', 'Submit GPS locations during an active assigned trip.'),
    ('WASTE_ASSIGN_AREA_DRIVERS', 'Assign available drivers to vehicles in the supervisor service area.'),
    ('WASTE_SET_DRIVER_AVAILABILITY', 'Set driver availability in the supervisor service area.'),
    ('WASTE_VIEW_ALL', 'View the entire waste collection fleet and trip status.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('WASTE_VIEW_OWN_ROUTE', 'WASTE_START_TRIP', 'WASTE_REPORT_LOCATION')
WHERE r.name = 'waste_driver'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'WASTE_VIEW_OWN_ROUTE', 'WASTE_START_TRIP', 'WASTE_REPORT_LOCATION',
    'WASTE_ASSIGN_AREA_DRIVERS', 'WASTE_SET_DRIVER_AVAILABILITY'
)
WHERE r.name = 'waste_supervisor'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'WASTE_VIEW_ALL'
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS waste_driver_availability (
    employee_id BIGINT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'on_leave', 'off_duty')),
    note VARCHAR(500),
    updated_by BIGINT REFERENCES employees(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS waste_collection_trips (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    administrative_unit_id BIGINT NOT NULL REFERENCES administrative_units(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    CHECK ((status = 'in_progress' AND ended_at IS NULL) OR status <> 'in_progress')
);

CREATE INDEX IF NOT EXISTS idx_waste_trips_area_status
    ON waste_collection_trips(administrative_unit_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_trips_vehicle_started
    ON waste_collection_trips(vehicle_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_trip_active_vehicle
    ON waste_collection_trips(vehicle_id) WHERE status = 'in_progress';
CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_trip_active_driver
    ON waste_collection_trips(driver_id) WHERE status = 'in_progress';
CREATE UNIQUE INDEX IF NOT EXISTS uq_waste_vehicle_active_driver
    ON vehicles(driver_id) WHERE driver_id IS NOT NULL AND is_active = TRUE;

-- Remove the retired synthetic 76-vehicle fleet; its route logs cascade with it.
DELETE FROM vehicles WHERE registration_number LIKE 'DEMO-HLD-%';

-- Eight existing block service areas, four drivers and one supervisor per area.
WITH areas AS (
    SELECT id, name, code,
           ROW_NUMBER() OVER (ORDER BY code) AS area_no,
           CASE code
             WHEN 'BLOCK-BETALGHAT' THEN 'BET'
             WHEN 'BLOCK-BHIMTAL' THEN 'BHM'
             WHEN 'BLOCK-DHARI' THEN 'DHA'
             WHEN 'BLOCK-HALDWANI' THEN 'HAL'
             WHEN 'BLOCK-KOTABAG' THEN 'KOT'
             WHEN 'BLOCK-OKHALKANDA' THEN 'OKH'
             WHEN 'BLOCK-RAMGARH' THEN 'RMG'
             WHEN 'BLOCK-RAMNAGAR' THEN 'RMN'
           END AS short_code
    FROM administrative_units
    WHERE is_active = TRUE AND unit_type = 'block'
      AND code IN (
        'BLOCK-BETALGHAT', 'BLOCK-BHIMTAL', 'BLOCK-DHARI', 'BLOCK-HALDWANI',
        'BLOCK-KOTABAG', 'BLOCK-OKHALKANDA', 'BLOCK-RAMGARH', 'BLOCK-RAMNAGAR'
      )
), driver_seed AS (
    SELECT a.*, slot,
           (a.area_no - 1) * 4 + slot AS driver_no,
           'EMP-WASTE-DRV-' || LPAD(((a.area_no - 1) * 4 + slot)::text, 3, '0') AS employee_code,
           'Collection Driver ' || a.name || ' ' || slot AS employee_name,
           'waste.driver.' || LOWER(REPLACE(a.name, ' ', '.')) || '.' || slot || '@nagarseu.demo' AS email,
           '91990001' || LPAD(((a.area_no - 1) * 4 + slot)::text, 4, '0') AS phone
    FROM areas a CROSS JOIN GENERATE_SERIES(1, 4) AS slot
), driver_rows AS (
    INSERT INTO employees (
        employee_id, name, email, phone, password_hash,
        department_id, administrative_unit_id, is_active
    )
    SELECT d.employee_code, d.employee_name, d.email, d.phone,
           '$2b$12$1sHQZUpyQqMN57WbPqatFOJHuzjv64juxjPZnBEcR3IPwy.w53AYy',
           dep.id, d.id, TRUE
    FROM driver_seed d
    JOIN departments dep ON dep.code = 'SAN'
    ON CONFLICT (employee_id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        department_id = EXCLUDED.department_id,
        administrative_unit_id = EXCLUDED.administrative_unit_id,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id, employee_id
)
SELECT COUNT(*) FROM driver_rows;

-- Normalize role membership for the seeded waste driver accounts.
DELETE FROM employee_roles er
USING employees e
WHERE er.employee_id = e.id AND e.employee_id LIKE 'EMP-WASTE-DRV-%';

INSERT INTO employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM employees e CROSS JOIN roles r
WHERE e.employee_id LIKE 'EMP-WASTE-DRV-%'
  AND e.is_active = TRUE
  AND r.name = 'waste_driver'
ON CONFLICT DO NOTHING;

INSERT INTO waste_driver_availability (employee_id, status)
SELECT e.id, 'available'
FROM employees e
WHERE e.employee_id LIKE 'EMP-WASTE-DRV-%' AND e.is_active = TRUE
ON CONFLICT (employee_id) DO NOTHING;

WITH areas AS (
    SELECT id, name, code,
           ROW_NUMBER() OVER (ORDER BY code) AS area_no
    FROM administrative_units
    WHERE is_active = TRUE AND unit_type = 'block'
      AND code IN (
        'BLOCK-BETALGHAT', 'BLOCK-BHIMTAL', 'BLOCK-DHARI', 'BLOCK-HALDWANI',
        'BLOCK-KOTABAG', 'BLOCK-OKHALKANDA', 'BLOCK-RAMGARH', 'BLOCK-RAMNAGAR'
      )
), supervisor_seed AS (
    SELECT a.*,
           'EMP-WASTE-SUP-' || LPAD(a.area_no::text, 3, '0') AS employee_code,
           'Area Supervisor ' || a.name AS employee_name,
           'waste.supervisor.' || LOWER(REPLACE(a.name, ' ', '.')) || '@nagarseu.demo' AS email,
           '91990002' || LPAD(a.area_no::text, 4, '0') AS phone
    FROM areas a
), supervisor_rows AS (
    INSERT INTO employees (
        employee_id, name, email, phone, password_hash,
        department_id, administrative_unit_id, is_active
    )
    SELECT s.employee_code, s.employee_name, s.email, s.phone,
           '$2b$12$XK4HcaObsnPq5JDKEffwoe3MStIapFNAlU2wZsPXZOUg5Dh.SEfzG',
           dep.id, s.id, TRUE
    FROM supervisor_seed s
    JOIN departments dep ON dep.code = 'SAN'
    ON CONFLICT (employee_id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password_hash = EXCLUDED.password_hash,
        department_id = EXCLUDED.department_id,
        administrative_unit_id = EXCLUDED.administrative_unit_id,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id, employee_id
)
SELECT COUNT(*) FROM supervisor_rows;

DELETE FROM employee_roles er
USING employees e
WHERE er.employee_id = e.id AND e.employee_id LIKE 'EMP-WASTE-SUP-%';

INSERT INTO employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM employees e CROSS JOIN roles r
WHERE e.employee_id LIKE 'EMP-WASTE-SUP-%'
  AND e.is_active = TRUE
  AND r.name = 'waste_supervisor'
ON CONFLICT DO NOTHING;

-- Seed three vehicles per area; each starts assigned to one of the first three
-- area drivers. The fourth driver in each area is the available relief driver.
WITH areas AS (
    SELECT id, name, code,
           ROW_NUMBER() OVER (ORDER BY code) AS area_no,
           CASE code
             WHEN 'BLOCK-BETALGHAT' THEN 'BET'
             WHEN 'BLOCK-BHIMTAL' THEN 'BHM'
             WHEN 'BLOCK-DHARI' THEN 'DHA'
             WHEN 'BLOCK-HALDWANI' THEN 'HAL'
             WHEN 'BLOCK-KOTABAG' THEN 'KOT'
             WHEN 'BLOCK-OKHALKANDA' THEN 'OKH'
             WHEN 'BLOCK-RAMGARH' THEN 'RMG'
             WHEN 'BLOCK-RAMNAGAR' THEN 'RMN'
           END AS short_code
    FROM administrative_units
    WHERE is_active = TRUE AND unit_type = 'block'
      AND code IN (
        'BLOCK-BETALGHAT', 'BLOCK-BHIMTAL', 'BLOCK-DHARI', 'BLOCK-HALDWANI',
        'BLOCK-KOTABAG', 'BLOCK-OKHALKANDA', 'BLOCK-RAMGARH', 'BLOCK-RAMNAGAR'
      )
), vehicle_seed AS (
    SELECT a.id AS area_id, a.short_code, slot,
           'WC-' || a.short_code || '-' || LPAD(slot::text, 3, '0') AS registration_number,
           'EMP-WASTE-DRV-' || LPAD((a.area_no * 4 - 4 + slot)::text, 3, '0') AS driver_code
    FROM areas a
    CROSS JOIN GENERATE_SERIES(1, 3) AS slot
)
INSERT INTO vehicles (registration_number, driver_id, administrative_unit_id, is_active)
SELECT v.registration_number, e.id, v.area_id, TRUE
FROM vehicle_seed v
JOIN employees e ON e.employee_id = v.driver_code
ON CONFLICT (registration_number) DO UPDATE SET
    driver_id = EXCLUDED.driver_id,
    administrative_unit_id = EXCLUDED.administrative_unit_id,
    is_active = TRUE;

COMMIT;
