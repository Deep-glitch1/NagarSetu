-- ============================================================
-- NAGARSETU - COMPLETE POSTGRESQL + POSTGIS DATABASE
-- Urban + Rural Civic Complaint Management Platform
-- Initial deployment target: Haldwani / Nainital, Uttarakhand
--
-- PostgreSQL 14+ recommended
-- Required extension: PostGIS
--
-- This script creates:
--   * Urban + rural administrative hierarchy
--   * Users and RBAC (roles/permissions)
--   * Departments and complaint categories
--   * Complaints, photos, assignments, status history
--   * SLA and automatic escalation data
--   * Phase 2: roads, clusters, trust-score history
--   * Phase 3: facilities, bookings, vehicles, route logs,
--              toilets, reviews and budget allocations
--   * Primary/foreign/composite keys, constraints and indexes
--   * PostGIS spatial indexes
--   * Triggers, functions, procedures and views
--
-- IMPORTANT:
--   1. Run as a PostgreSQL user allowed to CREATE EXTENSION.
--   2. PostGIS must be installed on the PostgreSQL server.
--   3. The script uses a dedicated schema named "nagarseu".
--   4. It does not drop an existing database or existing tables.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================
-- 1. ADMINISTRATIVE HIERARCHY
-- Supports both:
--   Urban: Municipal Corporation -> Ward
--   Rural: District -> Block -> Gram Panchayat -> Village
-- ============================================================

CREATE TABLE IF NOT EXISTS administrative_units (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,

    unit_type VARCHAR(30) NOT NULL
        CHECK (
            unit_type IN (
                'district',
                'block',
                'gram_panchayat',
                'village',
                 'municipality',
                'municipal_corporation',
                'nagar_panchayat',
                'municipal_zone',
                'ward'
            )
        ),

    parent_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE RESTRICT,

    boundary GEOMETRY(POLYGON, 4326),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_admin_units_parent
    ON administrative_units(parent_id);

CREATE INDEX IF NOT EXISTS idx_admin_units_type
    ON administrative_units(unit_type);

CREATE INDEX IF NOT EXISTS idx_admin_units_boundary
    ON administrative_units USING GIST(boundary);

-- ============================================================
-- 2. DEPARTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. COMPLAINT CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_categories (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. DEPARTMENT <-> CATEGORY (M:N)
-- ============================================================

CREATE TABLE IF NOT EXISTS department_categories (
    department_id BIGINT NOT NULL
        REFERENCES departments(id)
        ON DELETE CASCADE,

    category_id BIGINT NOT NULL
        REFERENCES complaint_categories(id)
        ON DELETE CASCADE,

    priority_weight NUMERIC(6,3) NOT NULL DEFAULT 1.000
        CHECK (priority_weight > 0),

    PRIMARY KEY (department_id, category_id)
);

-- ============================================================
-- 5. RBAC - ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- ============================================================
-- 6. RBAC - PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- ============================================================
-- 7. ROLE <-> PERMISSION (M:N)
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id BIGINT NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    permission_id BIGINT NOT NULL
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 8. citizens
-- ============================================================
CREATE TABLE IF NOT EXISTS citizens (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    phone VARCHAR(15) UNIQUE,

    password_hash TEXT NOT NULL,

    trust_score NUMERIC(5,2)
        CHECK (
            trust_score IS NULL
            OR trust_score BETWEEN 0 AND 100
        ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    email_verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_citizens_active
    ON citizens(is_active);

CREATE INDEX IF NOT EXISTS idx_citizens_email_verified
    ON citizens(email_verified);
-- ============================================================
-- 9. employees
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,

    employee_id VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    phone VARCHAR(15) UNIQUE,

    password_hash TEXT NOT NULL,

    department_id BIGINT
        REFERENCES departments(id)
        ON DELETE SET NULL,

    administrative_unit_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE SET NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_department
    ON employees(department_id);

CREATE INDEX IF NOT EXISTS idx_employees_admin_unit
    ON employees(administrative_unit_id);

CREATE INDEX IF NOT EXISTS idx_employees_active
    ON employees(is_active);



-- ============================================================
-- 10.Employee<-> ROLE (M:N)
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_roles (
    employee_id BIGINT NOT NULL
        REFERENCES employees(id)
        ON DELETE CASCADE,

    role_id BIGINT NOT NULL
        REFERENCES roles(id)
        ON DELETE CASCADE,

    PRIMARY KEY (employee_id, role_id)
);

-- ============================================================
-- 11. COMPLAINT SLA
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_sla (
    id BIGSERIAL PRIMARY KEY,

    category_id BIGINT NOT NULL UNIQUE
        REFERENCES complaint_categories(id)
        ON DELETE CASCADE,

    target_hours INTEGER NOT NULL
        CHECK (target_hours > 0),

    warning_percentage INTEGER NOT NULL DEFAULT 50
        CHECK (warning_percentage BETWEEN 1 AND 99),

    supervisor_percentage INTEGER NOT NULL DEFAULT 80
        CHECK (supervisor_percentage BETWEEN 1 AND 99),

    overdue_percentage INTEGER NOT NULL DEFAULT 100
        CHECK (overdue_percentage >= 100),

    critical_backlog_percentage INTEGER NOT NULL DEFAULT 300
        CHECK (critical_backlog_percentage >= 100),

    CHECK (warning_percentage < supervisor_percentage),
    CHECK (supervisor_percentage <= overdue_percentage),
    CHECK (overdue_percentage <= critical_backlog_percentage)
);

-- ============================================================
-- 12. COMPLAINTS
-- ============================================================

CREATE TABLE IF NOT EXISTS complaints (
    id BIGSERIAL PRIMARY KEY,

    complaint_number VARCHAR(30) NOT NULL UNIQUE,

    reported_by BIGINT NOT NULL
        REFERENCES citizens(id)
        ON DELETE RESTRICT,

    category_id BIGINT NOT NULL
        REFERENCES complaint_categories(id)
        ON DELETE RESTRICT,

    administrative_unit_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE SET NULL,

    department_id BIGINT
        REFERENCES departments(id)
        ON DELETE SET NULL,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    latitude DOUBLE PRECISION NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),

    longitude DOUBLE PRECISION NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),

    location GEOGRAPHY(Point, 4326),

    status VARCHAR(40) NOT NULL DEFAULT 'received'
        CHECK (
            status IN (
                'received',
                'assigned',
                 'in_progress',
                'pending_verification',
                'pending_citizen_response',
                'verified',
                'closed',
                'reopened',
                'rejected'
                
            )
        ),

    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (
            priority IN (
                'low',
                'medium',
                'high',
                'critical'
            )
        ),

    master_complaint_id BIGINT
        REFERENCES complaints(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        master_complaint_id IS NULL
        OR master_complaint_id <> id
    )
);

CREATE INDEX IF NOT EXISTS idx_complaints_reported_by
    ON complaints(reported_by);

CREATE INDEX IF NOT EXISTS idx_complaints_category
    ON complaints(category_id);

CREATE INDEX IF NOT EXISTS idx_complaints_admin_unit
    ON complaints(administrative_unit_id);

CREATE INDEX IF NOT EXISTS idx_complaints_department
    ON complaints(department_id);

CREATE INDEX IF NOT EXISTS idx_complaints_status
    ON complaints(status);

CREATE INDEX IF NOT EXISTS idx_complaints_priority
    ON complaints(priority);

CREATE INDEX IF NOT EXISTS idx_complaints_created_at
    ON complaints(created_at);

CREATE INDEX IF NOT EXISTS idx_complaints_master
    ON complaints(master_complaint_id);

CREATE INDEX IF NOT EXISTS idx_complaints_location
    ON complaints USING GIST(location);



-- ============================================================
-- 13. COMPLAINT PHOTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_photos (
    id BIGSERIAL PRIMARY KEY,

    complaint_id BIGINT NOT NULL
        REFERENCES complaints(id)
        ON DELETE CASCADE,

    photo_url TEXT NOT NULL,

    photo_type VARCHAR(30) NOT NULL
        CHECK (
            photo_type IN (
                'initial',
                'resolution',
                'evidence'
            )
        ),

    uploaded_by BIGINT
        REFERENCES employees(id)
        ON DELETE SET NULL,

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaint_photos_complaint
    ON complaint_photos(complaint_id);

-- ============================================================
-- 14. COMPLAINT ASSIGNMENT HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_assignments (
    id BIGSERIAL PRIMARY KEY,

    complaint_id BIGINT NOT NULL
        REFERENCES complaints(id)
        ON DELETE CASCADE,

    officer_id BIGINT NOT NULL
        REFERENCES employees(id)
        ON DELETE RESTRICT,

    assigned_by BIGINT
        REFERENCES employees(id)
        ON DELETE SET NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    unassigned_at TIMESTAMPTZ,

    CHECK (
        unassigned_at IS NULL
        OR unassigned_at >= assigned_at
    )
);

CREATE INDEX IF NOT EXISTS idx_assignments_complaint
    ON complaint_assignments(complaint_id);

CREATE INDEX IF NOT EXISTS idx_assignments_officer
    ON complaint_assignments(officer_id);

CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by
    ON complaint_assignments(assigned_by);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_complaint_assignment
    ON complaint_assignments(complaint_id)
    WHERE unassigned_at IS NULL;

-- ============================================================
-- 15. STATUS HISTORY / AUDIT TRAIL
-- ============================================================

CREATE TABLE IF NOT EXISTS status_history (
    id BIGSERIAL PRIMARY KEY,

    complaint_id BIGINT NOT NULL
        REFERENCES complaints(id)
        ON DELETE CASCADE,

    old_status VARCHAR(40)
        CHECK (
            old_status IS NULL
            OR old_status IN (
                'received',
                'assigned',
                'in_progress',
                'pending_verification',
                'verified',
                'pending_citizen_response',
                'closed',
                'reopened',
                'rejected'
            )
        ),

    new_status VARCHAR(40) NOT NULL
        CHECK (
            new_status IN (
                'received',
                'assigned',
                'in_progress',
                'pending_verification',
                'verified',
                'pending_citizen_response',
                'closed',
                'reopened',
                'rejected'
            )
        ),

    changed_by BIGINT
        REFERENCES employees(id)
        ON DELETE SET NULL,

    remarks TEXT,

    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        old_status IS NULL
        OR old_status <> new_status
    )

);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint
    ON status_history(complaint_id);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at
    ON status_history(changed_at);

-- ============================================================
-- 16. SLA ESCALATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_escalations (
    id BIGSERIAL PRIMARY KEY,

    complaint_id BIGINT NOT NULL
        REFERENCES complaints(id)
        ON DELETE CASCADE,

    escalation_level INTEGER NOT NULL
        CHECK (escalation_level > 0),

    escalation_percentage INTEGER
        CHECK (escalation_percentage >= 0),

    escalated_to BIGINT
        REFERENCES employees(id)
        ON DELETE SET NULL,

    reason TEXT,

    escalated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (complaint_id, escalation_level)
);

CREATE INDEX IF NOT EXISTS idx_escalations_complaint
    ON complaint_escalations(complaint_id);




    -- ============================================================
-- 17. complaint_citizen_responses
-- ============================================================


CREATE TABLE IF NOT EXISTS complaint_citizen_responses (
    id BIGSERIAL PRIMARY KEY,

    complaint_id BIGINT NOT NULL
        REFERENCES complaints(id)
        ON DELETE CASCADE,

    citizen_id BIGINT NOT NULL
        REFERENCES citizens(id)
        ON DELETE RESTRICT,

    response VARCHAR(20) NOT NULL
        CHECK (
            response IN (
                'satisfied',
                'reopen'
            )
        ),

    rating INTEGER
        CHECK (rating BETWEEN 1 AND 5),

    review TEXT,

    responded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (complaint_id, citizen_id)
);

CREATE INDEX IF NOT EXISTS idx_citizen_responses_complaint
    ON complaint_citizen_responses(complaint_id);

CREATE INDEX IF NOT EXISTS idx_citizen_responses_citizen
    ON complaint_citizen_responses(citizen_id);





-- ============================================================
-- 18. ROAD SEGMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS road_segments (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(200),

    geometry GEOMETRY(LineString, 4326) NOT NULL,

    administrative_unit_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE SET NULL,

    constructed_on DATE,

    last_repaved DATE,

    CHECK (
        last_repaved IS NULL
        OR constructed_on IS NULL
        OR last_repaved >= constructed_on
    )
);

CREATE INDEX IF NOT EXISTS idx_road_segments_geometry
    ON road_segments USING GIST(geometry);

CREATE INDEX IF NOT EXISTS idx_road_segments_admin_unit
    ON road_segments(administrative_unit_id);


-- ============================================================
-- ADD ROAD SEGMENT TO COMPLAINTS
-- ============================================================

ALTER TABLE complaints
    ADD COLUMN IF NOT EXISTS road_segment_id BIGINT
        REFERENCES road_segments(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_road_segment
    ON complaints(road_segment_id);


-- ============================================================
-- 19. ROAD RISK PREDICTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS road_risk_predictions (
    id BIGSERIAL PRIMARY KEY,

    road_segment_id BIGINT NOT NULL
        REFERENCES road_segments(id)
        ON DELETE CASCADE,

    risk_score NUMERIC(6,4) NOT NULL
        CHECK (risk_score BETWEEN 0 AND 1),

    prediction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    model_version VARCHAR(50) NOT NULL,

    prediction_horizon_days INTEGER NOT NULL
        CHECK (prediction_horizon_days > 0)
);

CREATE INDEX IF NOT EXISTS idx_road_risk_predictions_road
    ON road_risk_predictions(road_segment_id);

CREATE INDEX IF NOT EXISTS idx_road_risk_predictions_date
    ON road_risk_predictions(prediction_date);

CREATE INDEX IF NOT EXISTS idx_road_risk_predictions_score
    ON road_risk_predictions(risk_score);


-- ============================================================
-- 20. PHASE 2 - COMPLAINT CLUSTERS
-- ============================================================

CREATE TABLE IF NOT EXISTS complaint_clusters (
    id BIGSERIAL PRIMARY KEY,

    category_id BIGINT NOT NULL
        REFERENCES complaint_categories(id)
        ON DELETE RESTRICT,

    centroid GEOGRAPHY(Point, 4326) NOT NULL,

    complaint_count INTEGER NOT NULL
        CHECK (complaint_count > 0),

    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clusters_centroid
    ON complaint_clusters USING GIST(centroid);

CREATE INDEX IF NOT EXISTS idx_clusters_category
    ON complaint_clusters(category_id);

-- ============================================================
-- 21. PHASE 2 - TRUST SCORE HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_score_history (
    id BIGSERIAL PRIMARY KEY,

    citizen_id BIGINT NOT NULL
        REFERENCES citizens(id)
        ON DELETE CASCADE,

    complaint_id BIGINT
        REFERENCES complaints(id)
        ON DELETE SET NULL,

    previous_score NUMERIC(5,2)
        CHECK (
            previous_score IS NULL
            OR previous_score BETWEEN 0 AND 100
        ),

    new_score NUMERIC(5,2) NOT NULL
        CHECK (new_score BETWEEN 0 AND 100),

    reason VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_history_user
    ON trust_score_history(citizen_id);

CREATE INDEX IF NOT EXISTS idx_trust_history_complaint
    ON trust_score_history(complaint_id);

-- ============================================================
-- 22. PHASE 3 - FACILITIES
-- ============================================================

CREATE TABLE IF NOT EXISTS facilities (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    facility_type VARCHAR(50) NOT NULL,

    administrative_unit_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE SET NULL,

    location GEOGRAPHY(Point, 4326) NOT NULL,

    capacity INTEGER
        CHECK (capacity IS NULL OR capacity > 0),

    is_bookable BOOLEAN NOT NULL DEFAULT FALSE,

    price_per_slot NUMERIC(10,2),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        is_bookable = TRUE
        OR capacity IS NULL
    ),

    CHECK (
        price_per_slot IS NULL
        OR price_per_slot >= 0
    ),

    CHECK (
        is_bookable = FALSE
        OR capacity IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_facilities_location
    ON facilities USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_facilities_admin_unit
    ON facilities(administrative_unit_id);

CREATE INDEX IF NOT EXISTS idx_facilities_type
    ON facilities(facility_type);


-- ============================================================
-- 23. PHASE 3 - BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,

    facility_id BIGINT NOT NULL
        REFERENCES facilities(id)
        ON DELETE RESTRICT,

    citizen_id BIGINT NOT NULL
        REFERENCES citizens(id)
        ON DELETE RESTRICT,

    booking_date DATE NOT NULL,

    slot_time TIME NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'confirmed',
                'rejected',
                'cancelled'
            )
        ),

    payment_status VARCHAR(30) NOT NULL DEFAULT 'not_required'
        CHECK (
            payment_status IN (
                'not_required',
                'pending',
                'paid',
                'failed',
                'refunded'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (facility_id, booking_date, slot_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_citizen
    ON bookings(citizen_id);

CREATE INDEX IF NOT EXISTS idx_bookings_facility_date
    ON bookings(facility_id, booking_date);

-- ============================================================
-- 24. PHASE 3 - VEHICLES
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id BIGSERIAL PRIMARY KEY,

    registration_number VARCHAR(30) NOT NULL UNIQUE,

    driver_id BIGINT
    REFERENCES employees(id)
    ON DELETE SET NULL,

    administrative_unit_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE SET NULL,

    current_location GEOGRAPHY(Point, 4326),

    last_updated TIMESTAMPTZ,

    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_vehicles_location
    ON vehicles USING GIST(current_location);

CREATE INDEX IF NOT EXISTS idx_vehicles_admin_unit
    ON vehicles(administrative_unit_id);

-- ============================================================
-- 25. PHASE 3 - ROUTE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS route_logs (
    id BIGSERIAL PRIMARY KEY,

    vehicle_id BIGINT NOT NULL
        REFERENCES vehicles(id)
        ON DELETE CASCADE,

    administrative_unit_id BIGINT
        REFERENCES administrative_units(id)
        ON DELETE SET NULL,

    location GEOGRAPHY(Point, 4326) NOT NULL,

    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_route_logs_location
    ON route_logs USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_route_logs_vehicle_time
    ON route_logs(vehicle_id, recorded_at);
-- ============================================================

-- ============================================================
-- 26. PHASE 3 - BUDGET ALLOCATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_allocations (
    id BIGSERIAL PRIMARY KEY,

    department_id BIGINT NOT NULL
        REFERENCES departments(id)
        ON DELETE RESTRICT,

    administrative_unit_id BIGINT NOT NULL
        REFERENCES administrative_units(id)
        ON DELETE RESTRICT,

    fiscal_year INTEGER NOT NULL
        CHECK (fiscal_year >= 2000),

    recommended_amount NUMERIC(15,2) NOT NULL
        CHECK (recommended_amount >= 0),

    approved_amount NUMERIC(15,2)
        CHECK (approved_amount IS NULL OR approved_amount >= 0),

    justification_data JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        department_id,
        administrative_unit_id,
        fiscal_year
    )
);


-- ============================================================
-- SEQUENCE
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS complaint_number_seq
    START WITH 1
    INCREMENT BY 1;

-- ============================================================
-- FUNCTIONS
-- ============================================================


-- ============================================================
-- 1. AUTOMATIC COMPLAINT LOCATION
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_complaint_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.location :=
        ST_SetSRID(
            ST_MakePoint(NEW.longitude, NEW.latitude),
            4326
        )::geography;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_complaint_location
ON complaints;

CREATE TRIGGER trg_set_complaint_location
BEFORE INSERT OR UPDATE OF latitude, longitude
ON complaints
FOR EACH ROW
EXECUTE FUNCTION fn_set_complaint_location();


-- ============================================================
-- 2. AUTOMATIC UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


-- CITIZENS

DROP TRIGGER IF EXISTS trg_citizens_updated_at
ON citizens;

CREATE TRIGGER trg_citizens_updated_at
BEFORE UPDATE ON citizens
FOR EACH ROW
EXECUTE FUNCTION fn_update_timestamp();


-- EMPLOYEES

DROP TRIGGER IF EXISTS trg_employees_updated_at
ON employees;

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION fn_update_timestamp();


-- COMPLAINTS

DROP TRIGGER IF EXISTS trg_complaints_updated_at
ON complaints;

CREATE TRIGGER trg_complaints_updated_at
BEFORE UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION fn_update_timestamp();


-- ============================================================
-- 3. CURRENT EMPLOYEE CONTEXT
-- ============================================================



CREATE OR REPLACE FUNCTION fn_set_current_employee(
    p_employee_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM employees
        WHERE id = p_employee_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Employee % does not exist or is inactive',
            p_employee_id;
    END IF;

    PERFORM set_config(
        'nagarseu.current_employee_id',
        p_employee_id::TEXT,
        TRUE
    );

END;
$$;

CREATE OR REPLACE FUNCTION fn_current_employee()
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_employee_id TEXT;
BEGIN
    v_employee_id := current_setting(
        'nagarseu.current_employee_id',
        TRUE
    );

    IF v_employee_id IS NULL OR v_employee_id = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_employee_id::BIGINT;

EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;


CREATE OR REPLACE FUNCTION fn_close_complaint_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IN ('closed', 'rejected')
       AND OLD.status IS DISTINCT FROM NEW.status THEN

        UPDATE complaint_assignments
        SET unassigned_at = CURRENT_TIMESTAMP
        WHERE complaint_id = NEW.id
          AND unassigned_at IS NULL;

    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_complaint_assignment
ON complaints;

CREATE TRIGGER trg_close_complaint_assignment
AFTER UPDATE OF status
ON complaints
FOR EACH ROW
EXECUTE FUNCTION fn_close_complaint_assignment();

-- ============================================================
-- 4. COMPLAINT STATUS HISTORY
-- ============================================================

CREATE OR REPLACE FUNCTION fn_log_complaint_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    -- Initial complaint status
    IF TG_OP = 'INSERT' THEN

        INSERT INTO status_history (
            complaint_id,
            old_status,
            new_status,
            changed_by,
            remarks
        )
        VALUES (
            NEW.id,
            NULL,
            NEW.status,
            fn_current_employee(),
            'Initial complaint status'
        );

        RETURN NEW;
    END IF;


    -- Log only actual status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN

        INSERT INTO status_history (
            complaint_id,
            old_status,
            new_status,
            changed_by
        )
        VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            fn_current_employee()
        );

    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_log_complaint_status
ON complaints;

CREATE TRIGGER trg_log_complaint_status
AFTER INSERT OR UPDATE OF status
ON complaints
FOR EACH ROW
EXECUTE FUNCTION fn_log_complaint_status();


-- ============================================================
-- 5. UPDATE VEHICLE LOCATION FROM ROUTE LOG
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_vehicle_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    UPDATE vehicles
    SET
        current_location = NEW.location,
        last_updated = NEW.recorded_at
    WHERE id = NEW.vehicle_id
      AND (
          last_updated IS NULL
          OR NEW.recorded_at >= last_updated
      );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_vehicle_location
ON route_logs;

CREATE TRIGGER trg_update_vehicle_location
AFTER INSERT
ON route_logs
FOR EACH ROW
EXECUTE FUNCTION fn_update_vehicle_location();


-- ============================================================
-- 6. GENERATE COMPLAINT NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION fn_generate_complaint_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.complaint_number IS NULL
       OR BTRIM(NEW.complaint_number) = '' THEN

        NEW.complaint_number :=
            'NGS-' ||
            TO_CHAR(CURRENT_DATE, 'YYYYMMDD') ||
            '-' ||
            LPAD(
                nextval('public.complaint_number_seq')::TEXT,
                6,
                '0'
            );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_complaint_number
ON complaints;

CREATE TRIGGER trg_generate_complaint_number
BEFORE INSERT ON complaints
FOR EACH ROW
EXECUTE FUNCTION fn_generate_complaint_number();

-- ============================================================
-- 7. FIND ADMINISTRATIVE UNIT FROM LOCATION
-- ============================================================
CREATE OR REPLACE FUNCTION fn_find_administrative_unit(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS TABLE (
    unit_id BIGINT,
    unit_name VARCHAR,
    unit_type VARCHAR
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        au.id,
        au.name,
        au.unit_type
    FROM administrative_units au
    WHERE au.is_active = TRUE
      AND au.boundary IS NOT NULL
      AND ST_Covers(
            au.boundary,
            ST_SetSRID(
                ST_MakePoint(
                    p_longitude,
                    p_latitude
                ),
                4326
            )
      )
    ORDER BY ST_Area(au.boundary) ASC
    LIMIT 1;
$$;


-- ============================================================
-- 8. DISTANCE BETWEEN TWO GPS POINTS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_distance_meters(
    p_lat1 DOUBLE PRECISION,
    p_lon1 DOUBLE PRECISION,
    p_lat2 DOUBLE PRECISION,
    p_lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ST_Distance(
        ST_SetSRID(
            ST_MakePoint(
                p_lon1,
                p_lat1
            ),
            4326
        )::geography,

        ST_SetSRID(
            ST_MakePoint(
                p_lon2,
                p_lat2
            ),
            4326
        )::geography
    );
$$;


-- ============================================================
-- 9. Citizen response
-- ============================================================
CREATE OR REPLACE FUNCTION fn_handle_citizen_response()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status VARCHAR(40);
BEGIN
    SELECT status
    INTO v_status
    FROM complaints
    WHERE id = NEW.complaint_id
      AND reported_by = NEW.citizen_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Citizen % is not the owner of complaint %',
            NEW.citizen_id,
            NEW.complaint_id;
    END IF;


    -- Citizen is satisfied with the resolution
    IF NEW.response = 'satisfied' THEN

        IF v_status NOT IN (
            'pending_citizen_response',
            'verified'
        ) THEN
            RAISE EXCEPTION
                'Complaint % is not ready for satisfaction response. Current status: %',
                NEW.complaint_id,
                v_status;
        END IF;

        UPDATE complaints
        SET status = 'closed'
        WHERE id = NEW.complaint_id;

    END IF;


    -- Citizen is not satisfied and wants the complaint reopened
    IF NEW.response = 'reopen' THEN

        IF v_status NOT IN (
            'pending_citizen_response',
            'verified',
            'closed'
        ) THEN
            RAISE EXCEPTION
                'Complaint % cannot be reopened from status %',
                NEW.complaint_id,
                v_status;
        END IF;

        UPDATE complaints
        SET status = 'reopened'
        WHERE id = NEW.complaint_id;

    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_handle_citizen_response
ON complaint_citizen_responses;

CREATE TRIGGER trg_handle_citizen_response
AFTER INSERT ON complaint_citizen_responses
FOR EACH ROW
EXECUTE FUNCTION fn_handle_citizen_response();
-- ============================================================
-- 10.VALIDATE COMPLAINT STATUS TRANSITIONS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validate_complaint_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    -- No validation needed when status has not changed
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;


    -- received → assigned or rejected
    IF OLD.status = 'received'
       AND NEW.status NOT IN ('assigned', 'rejected') THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- assigned → in_progress
    IF OLD.status = 'assigned'
       AND NEW.status NOT IN ('in_progress', 'rejected') THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- in_progress → pending_verification
    IF OLD.status = 'in_progress'
       AND NEW.status NOT IN ('pending_verification', 'rejected') THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- pending_verification → verified / in_progress
    IF OLD.status = 'pending_verification'
       AND NEW.status NOT IN ('verified', 'in_progress') THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


   -- verified → pending_citizen_response / closed / reopened
IF OLD.status = 'verified'
   AND NEW.status NOT IN (
       'pending_citizen_response',
       'closed',
       'reopened'
   ) THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- pending_citizen_response → closed / reopened
    IF OLD.status = 'pending_citizen_response'
       AND NEW.status NOT IN ('closed', 'reopened') THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- closed → reopened
    IF OLD.status = 'closed'
       AND NEW.status <> 'reopened' THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- reopened → assigned / in_progress
    IF OLD.status = 'reopened'
       AND NEW.status NOT IN ('assigned', 'in_progress') THEN

        RAISE EXCEPTION
            'Invalid status transition: % -> %',
            OLD.status,
            NEW.status;
    END IF;


    -- rejected is terminal
    IF OLD.status = 'rejected' THEN

        RAISE EXCEPTION
            'Rejected complaint cannot change status';

    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_validate_complaint_status
ON complaints;

CREATE TRIGGER trg_validate_complaint_status
BEFORE UPDATE OF status
ON complaints
FOR EACH ROW
EXECUTE FUNCTION fn_validate_complaint_status();



-- ============================================================
-- 11. RBAC PERMISSION CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION fn_has_permission(
    p_employee_id BIGINT,
    p_permission_code VARCHAR
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM employees e
        JOIN employee_roles er
            ON er.employee_id = e.id
        JOIN roles r
            ON r.id = er.role_id
        JOIN role_permissions rp
            ON rp.role_id = r.id
        JOIN permissions p
            ON p.id = rp.permission_id
        WHERE e.id = p_employee_id
          AND e.is_active = TRUE
          AND p.code = p_permission_code
    );
$$;

-- ============================================================
-- PROCEDURES
-- ============================================================
-- ============================================================
-- 1. CREATE COMPLAINT
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_create_complaint(
    p_citizen_id BIGINT,
    p_category_id BIGINT,
    p_admin_unit_id BIGINT DEFAULT NULL,
    p_title VARCHAR DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL,
    p_priority VARCHAR DEFAULT 'medium'
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_department_id BIGINT;
    v_complaint_id BIGINT;
    v_found_unit_id BIGINT;
BEGIN

    -- Validate citizen
    IF NOT EXISTS (
        SELECT 1
        FROM citizens
        WHERE id = p_citizen_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Citizen % does not exist or is inactive',
            p_citizen_id;
    END IF;


    -- Validate category
    IF NOT EXISTS (
        SELECT 1
        FROM complaint_categories
        WHERE id = p_category_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Category % does not exist or is inactive',
            p_category_id;
    END IF;


    -- Validate title
    IF p_title IS NULL OR BTRIM(p_title) = '' THEN
        RAISE EXCEPTION
            'Complaint title is required';
    END IF;


    -- Validate coordinates
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
        RAISE EXCEPTION
            'Latitude and longitude are required';
    END IF;

    IF p_latitude NOT BETWEEN -90 AND 90 THEN
        RAISE EXCEPTION
            'Invalid latitude: %',
            p_latitude;
    END IF;

    IF p_longitude NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION
            'Invalid longitude: %',
            p_longitude;
    END IF;


    -- Validate administrative unit
    IF p_admin_unit_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM administrative_units
            WHERE id = p_admin_unit_id
              AND is_active = TRUE
       )
    THEN
        RAISE EXCEPTION
            'Administrative unit % does not exist or is inactive',
            p_admin_unit_id;
    END IF;


    -- Validate priority
    IF p_priority NOT IN (
        'low',
        'medium',
        'high',
        'critical'
    ) THEN
        RAISE EXCEPTION
            'Invalid priority: %',
            p_priority;
    END IF;


    -- Find responsible department
    SELECT dc.department_id
    INTO v_department_id
    FROM department_categories dc
    JOIN departments d
        ON d.id = dc.department_id
    WHERE dc.category_id = p_category_id
      AND d.is_active = TRUE
    ORDER BY dc.priority_weight DESC,
             dc.department_id
    LIMIT 1;


    IF v_department_id IS NULL THEN
        RAISE EXCEPTION
            'No active department is mapped to category %',
            p_category_id;
    END IF;


    -- Create complaint
    INSERT INTO complaints (
        reported_by,
        category_id,
        administrative_unit_id,
        department_id,
        title,
        description,
        latitude,
        longitude,
        priority
    )
    VALUES (
        p_citizen_id,
        p_category_id,
        p_admin_unit_id,
        v_department_id,
        BTRIM(p_title),
        p_description,
        p_latitude,
        p_longitude,
        p_priority
    )
    RETURNING id INTO v_complaint_id;


    RAISE NOTICE
        'Complaint created with ID %',
        v_complaint_id;

END;
$$;

-- ============================================================
-- 2. ASSIGN COMPLAINT
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_assign_complaint(
    p_complaint_id BIGINT,
    p_officer_id BIGINT,
    p_assigned_by BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_complaint_department_id BIGINT;
    v_complaint_status VARCHAR(40);
BEGIN

    -- 1. Lock complaint to prevent concurrent assignments
    SELECT
        department_id,
        status
    INTO
        v_complaint_department_id,
        v_complaint_status
    FROM complaints
    WHERE id = p_complaint_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Complaint % does not exist',
            p_complaint_id;
    END IF;


    -- 2. Validate assigning employee
    IF NOT EXISTS (
        SELECT 1
        FROM employees
        WHERE id = p_assigned_by
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Assigning employee % does not exist or is inactive',
            p_assigned_by;
    END IF;


    -- 3. Validate RBAC permission
    IF NOT fn_has_permission(
        p_assigned_by,
        'COMPLAINT_ASSIGN'
    ) THEN
        RAISE EXCEPTION
            'Employee % does not have permission to assign complaints',
            p_assigned_by;
    END IF;


    -- 4. Validate officer
    IF NOT EXISTS (
        SELECT 1
        FROM employees
        WHERE id = p_officer_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Officer % does not exist or is inactive',
            p_officer_id;
    END IF;


    -- 5. Officer must belong to complaint's department
    IF v_complaint_department_id IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM employees
            WHERE id = p_officer_id
              AND department_id = v_complaint_department_id
              AND is_active = TRUE
       )
    THEN
        RAISE EXCEPTION
            'Officer % does not belong to the department assigned to complaint %',
            p_officer_id,
            p_complaint_id;
    END IF;


    -- 6. Complaint must be assignable
    IF v_complaint_status NOT IN (
        'received',
        'assigned',
        'reopened'
    ) THEN
        RAISE EXCEPTION
            'Complaint % cannot be assigned from status %',
            p_complaint_id,
            v_complaint_status;
    END IF;


    -- 7. Prevent assigning the same officer again
    IF EXISTS (
        SELECT 1
        FROM complaint_assignments
        WHERE complaint_id = p_complaint_id
          AND officer_id = p_officer_id
          AND unassigned_at IS NULL
    ) THEN
        RAISE EXCEPTION
            'Complaint % is already assigned to officer %',
            p_complaint_id,
            p_officer_id;
    END IF;


    -- 8. Set current employee context for status-history trigger
    PERFORM fn_set_current_employee(p_assigned_by);


    -- 9. Close any previous active assignment
    UPDATE complaint_assignments
    SET unassigned_at = CURRENT_TIMESTAMP
    WHERE complaint_id = p_complaint_id
      AND unassigned_at IS NULL;


    -- 10. Create new assignment
    INSERT INTO complaint_assignments (
        complaint_id,
        officer_id,
        assigned_by,
        assigned_at
    )
    VALUES (
        p_complaint_id,
        p_officer_id,
        p_assigned_by,
        CURRENT_TIMESTAMP
    );


    -- 11. Move complaint into assigned state
    UPDATE complaints
    SET status = 'assigned'
    WHERE id = p_complaint_id;


    RAISE NOTICE
        'Complaint % assigned to officer % by employee %',
        p_complaint_id,
        p_officer_id,
        p_assigned_by;

END;
$$;

-- ============================================================
-- 3. UPDATE COMPLAINT STATUS
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_update_complaint_status(
    p_complaint_id BIGINT,
    p_new_status VARCHAR,
    p_employee_id BIGINT,
    p_remarks TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_status VARCHAR(40);
BEGIN

    -- 1. Lock complaint
    SELECT status
    INTO v_old_status
    FROM complaints
    WHERE id = p_complaint_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Complaint % does not exist',
            p_complaint_id;
    END IF;


    -- 2. Validate employee
    IF NOT EXISTS (
        SELECT 1
        FROM employees
        WHERE id = p_employee_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Employee % does not exist or is inactive',
            p_employee_id;
    END IF;


    -- 3. Validate RBAC permission
    IF NOT fn_has_permission(
        p_employee_id,
        'COMPLAINT_STATUS_UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Employee % does not have permission to update complaint status',
            p_employee_id;
    END IF;


    -- 4. Validate status value
    IF p_new_status NOT IN (
        'received',
        'assigned',
        'in_progress',
        'pending_verification',
        'verified',
        'pending_citizen_response',
        'closed',
        'reopened',
        'rejected'
    ) THEN
        RAISE EXCEPTION
            'Invalid complaint status: %',
            p_new_status;
    END IF;


    -- 5. Prevent unnecessary update
    IF v_old_status = p_new_status THEN
        RAISE EXCEPTION
            'Complaint % is already in status %',
            p_complaint_id,
            p_new_status;
    END IF;


    -- 6. Set employee context for status-history trigger
    PERFORM fn_set_current_employee(p_employee_id);


    -- 7. Status-transition trigger validates the transition
    UPDATE complaints
    SET status = p_new_status
    WHERE id = p_complaint_id;


    -- 8. Add remarks to the status-history entry
    IF p_remarks IS NOT NULL THEN
        UPDATE status_history
        SET remarks = p_remarks
        WHERE id = (
            SELECT id
            FROM status_history
            WHERE complaint_id = p_complaint_id
              AND old_status = v_old_status
              AND new_status = p_new_status
            ORDER BY changed_at DESC, id DESC
            LIMIT 1
        );
    END IF;

END;
$$;

-- ============================================================
-- 4. SUBMIT CITIZEN RESPONSE
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_submit_citizen_response(
    p_complaint_id BIGINT,
    p_citizen_id BIGINT,
    p_response VARCHAR,
    p_rating INTEGER DEFAULT NULL,
    p_review TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reported_by BIGINT;
    v_status VARCHAR(40);
BEGIN

    -- 1. Lock complaint
    SELECT
        reported_by,
        status
    INTO
        v_reported_by,
        v_status
    FROM complaints
    WHERE id = p_complaint_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Complaint % does not exist',
            p_complaint_id;
    END IF;


    -- 2. Validate citizen
    IF NOT EXISTS (
        SELECT 1
        FROM citizens
        WHERE id = p_citizen_id
          AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION
            'Citizen % does not exist or is inactive',
            p_citizen_id;
    END IF;


    -- 3. Only complaint owner can respond
    IF v_reported_by <> p_citizen_id THEN
        RAISE EXCEPTION
            'Citizen % is not the owner of complaint %',
            p_citizen_id,
            p_complaint_id;
    END IF;


    -- 4. Validate response
    IF p_response NOT IN (
        'satisfied',
        'reopen'
    ) THEN
        RAISE EXCEPTION
            'Invalid response: %',
            p_response;
    END IF;


    -- 5. Validate rating
    IF p_rating IS NOT NULL
       AND p_rating NOT BETWEEN 1 AND 5 THEN
        RAISE EXCEPTION
            'Rating must be between 1 and 5';
    END IF;


    -- 6. Prevent duplicate response
    IF EXISTS (
        SELECT 1
        FROM complaint_citizen_responses
        WHERE complaint_id = p_complaint_id
          AND citizen_id = p_citizen_id
    ) THEN
        RAISE EXCEPTION
            'Citizen % has already responded to complaint %',
            p_citizen_id,
            p_complaint_id;
    END IF;


    -- 7. Validate status according to response type

    -- Satisfied → complaint becomes closed
    IF p_response = 'satisfied'
       AND v_status NOT IN (
           'pending_citizen_response',
           'verified'
       )
    THEN
        RAISE EXCEPTION
            'Complaint % is not ready for satisfaction response. Current status: %',
            p_complaint_id,
            v_status;
    END IF;


    -- Reopen → complaint becomes reopened
    IF p_response = 'reopen'
       AND v_status NOT IN (
           'pending_citizen_response',
           'verified',
           'closed'
       )
    THEN
        RAISE EXCEPTION
            'Complaint % cannot be reopened from status %',
            p_complaint_id,
            v_status;
    END IF;


    -- 8. Insert citizen response
    INSERT INTO complaint_citizen_responses (
        complaint_id,
        citizen_id,
        response,
        rating,
        review
    )
    VALUES (
        p_complaint_id,
        p_citizen_id,
        p_response,
        p_rating,
        p_review
    );

END;
$$;
-- ============================================================
-- VIEWS
-- ============================================================


-- ============================================================
-- 1. OFFICER COMPLAINT QUEUE
-- ============================================================
CREATE OR REPLACE VIEW v_officer_complaint_queue AS
SELECT
    c.id,
    c.complaint_number,
    c.title,

    cc.code AS category_code,
    cc.name AS category,

    d.code AS department_code,
    d.name AS department,

    e.id AS officer_id,
    e.name AS officer_name,

    c.priority,
    c.status,

    au.name AS administrative_area,
    au.unit_type AS administrative_area_type,

    c.created_at,
    c.updated_at

FROM complaints c

JOIN complaint_categories cc
    ON c.category_id = cc.id

LEFT JOIN departments d
    ON c.department_id = d.id

LEFT JOIN complaint_assignments ca
    ON ca.complaint_id = c.id
   AND ca.unassigned_at IS NULL

LEFT JOIN employees e
    ON ca.officer_id = e.id

LEFT JOIN administrative_units au
    ON c.administrative_unit_id = au.id

WHERE c.status NOT IN (
    'verified',
    'pending_citizen_response',
    'closed',
    'rejected'
);


-- ============================================================
-- 2. PUBLIC COMPLAINTS
-- ============================================================
CREATE OR REPLACE VIEW v_public_complaints AS
SELECT
    c.complaint_number,
    c.title,

    cc.name AS category,

    c.status,
    c.priority,

    au.name AS administrative_area,

    c.created_at

FROM complaints c

JOIN complaint_categories cc
    ON c.category_id = cc.id

LEFT JOIN administrative_units au
    ON c.administrative_unit_id = au.id;


-- ============================================================
-- 3. OVERDUE COMPLAINTS
-- ============================================================
CREATE OR REPLACE VIEW v_overdue_complaints AS
SELECT
    c.id,
    c.complaint_number,
    c.title,

    cc.name AS category,
    d.name AS department,

    e.name AS assigned_officer,

    c.priority,
    c.status,
    c.created_at,

    EXTRACT(
        EPOCH FROM (
            CURRENT_TIMESTAMP - c.created_at
        )
    ) / 3600 AS age_hours,

    sla.target_hours

FROM complaints c

JOIN complaint_categories cc
    ON c.category_id = cc.id

LEFT JOIN departments d
    ON c.department_id = d.id

LEFT JOIN complaint_assignments ca
    ON ca.complaint_id = c.id
   AND ca.unassigned_at IS NULL

LEFT JOIN employees e
    ON ca.officer_id = e.id

LEFT JOIN complaint_sla sla
    ON c.category_id = sla.category_id

WHERE c.status NOT IN (
    'verified',
    'closed',
    'rejected'
)

AND sla.target_hours IS NOT NULL

AND CURRENT_TIMESTAMP >
    c.created_at +
    make_interval(
        hours => sla.target_hours
    );

-- ============================================================
-- 4. DEPARTMENT PERFORMANCE
-- ============================================================
CREATE OR REPLACE VIEW v_department_performance AS
SELECT
    d.id,
    d.code,
    d.name,

    COUNT(c.id) AS total_complaints,

    COUNT(c.id) FILTER (
        WHERE c.status IN (
            'verified',
            'closed'
        )
    ) AS resolved_complaints,

    COUNT(c.id) FILTER (
        WHERE sla.target_hours IS NOT NULL
          AND CURRENT_TIMESTAMP >
              c.created_at +
              make_interval(
                  hours => sla.target_hours
              )
          AND c.status NOT IN (
              'verified',
              'closed',
              'rejected'
          )
    ) AS overdue_complaints,

    COUNT(c.id) FILTER (
        WHERE c.priority = 'critical'
    ) AS critical_complaints

FROM departments d

LEFT JOIN complaints c
    ON c.department_id = d.id

LEFT JOIN complaint_sla sla
    ON c.category_id = sla.category_id

GROUP BY
    d.id,
    d.code,
    d.name;


-- ============================================================
-- 5. AREA PERFORMANCE
-- ============================================================
CREATE OR REPLACE VIEW v_area_performance AS
SELECT
    au.id,
    au.code,
    au.name,
    au.unit_type,

    COUNT(c.id) AS total_complaints,

    COUNT(c.id) FILTER (
        WHERE c.status IN (
            'verified',
            'closed'
        )
    ) AS resolved_complaints,

    COUNT(c.id) FILTER (
        WHERE sla.target_hours IS NOT NULL
          AND CURRENT_TIMESTAMP >
              c.created_at +
              make_interval(
                  hours => sla.target_hours
              )
          AND c.status NOT IN (
              'verified',
              'closed',
              'rejected'
          )
    ) AS overdue_complaints

FROM administrative_units au

LEFT JOIN complaints c
    ON c.administrative_unit_id = au.id

LEFT JOIN complaint_sla sla
    ON c.category_id = sla.category_id

GROUP BY
    au.id,
    au.code,
    au.name,
    au.unit_type;
-- ============================================================
-- ROAD SEGMENT VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_road_segments AS
SELECT
    rs.id,
    rs.name,
    rs.geometry,

    rs.administrative_unit_id,
    au.name AS administrative_area,
    au.unit_type AS administrative_area_type,

    rs.constructed_on,
    rs.last_repaved,

    CASE
        WHEN rs.last_repaved IS NOT NULL
            THEN EXTRACT(
                YEAR FROM AGE(
                    CURRENT_DATE,
                    rs.last_repaved
                )
            )

        WHEN rs.constructed_on IS NOT NULL
            THEN EXTRACT(
                YEAR FROM AGE(
                    CURRENT_DATE,
                    rs.constructed_on
                )
            )

        ELSE NULL
    END AS effective_age_years

FROM road_segments rs

LEFT JOIN administrative_units au
    ON rs.administrative_unit_id = au.id;

-- ============================================================
-- SEED DATA
-- ============================================================
-- ============================================================
-- NAINITAL DISTRICT ADMINISTRATIVE UNITS
-- ============================================================


-- ============================================================
-- 1. DISTRICT
-- ============================================================

INSERT INTO administrative_units
    (name, code, unit_type, parent_id)
VALUES
    (
        'Nainital',
        'DIST-NAINITAL',
        'district',
        NULL
    )
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 2. DEVELOPMENT BLOCKS
-- ============================================================

INSERT INTO administrative_units
    (name, code, unit_type, parent_id)

SELECT
    v.name,
    v.code,
    'block',
    d.id

FROM (
    VALUES
        ('Haldwani',   'BLOCK-HALDWANI'),
        ('Bhimtal',    'BLOCK-BHIMTAL'),
        ('Ramnagar',   'BLOCK-RAMNAGAR'),
        ('Kotabag',    'BLOCK-KOTABAG'),
        ('Dhari',      'BLOCK-DHARI'),
        ('Betalghat',  'BLOCK-BETALGHAT'),
        ('Ramgarh',    'BLOCK-RAMGARH'),
        ('Okhalkanda', 'BLOCK-OKHALKANDA')
) AS v(name, code)

JOIN administrative_units d
    ON d.code = 'DIST-NAINITAL'

ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 3. MUNICIPAL CORPORATION
-- ============================================================

INSERT INTO administrative_units
    (name, code, unit_type, parent_id)

SELECT
    'Haldwani-Kathgodam Municipal Corporation',
    'ULB-HALDWANI-KATHGODAM',
    'municipal_corporation',
    id

FROM administrative_units

WHERE code = 'DIST-NAINITAL'

ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 4. MUNICIPALITIES
-- ============================================================

INSERT INTO administrative_units
    (name, code, unit_type, parent_id)

SELECT
    v.name,
    v.code,
    'municipality',
    d.id

FROM (
    VALUES
        ('Nainital Municipality', 'ULB-NAINITAL'),
        ('Bhowali Municipality', 'ULB-BHOWALI'),
        ('Ramnagar Municipality', 'ULB-RAMNAGAR')
) AS v(name, code)

JOIN administrative_units d
    ON d.code = 'DIST-NAINITAL'

ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 5. NAGAR PANCHAYATS
-- ============================================================

INSERT INTO administrative_units
    (name, code, unit_type, parent_id)

SELECT
    v.name,
    v.code,
    'nagar_panchayat',
    d.id

FROM (
    VALUES
        ('Lalkua Nagar Panchayat', 'ULB-LALKUA'),
        ('Bhimtal Nagar Panchayat', 'ULB-BHIMTAL'),
        ('Kaladhungi Nagar Panchayat', 'ULB-KALADHUNGI')
) AS v(name, code)

JOIN administrative_units d
    ON d.code = 'DIST-NAINITAL'

ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- DEPARTMENTS
-- ============================================================


INSERT INTO departments
    (code, name, description)
VALUES
    (
        'ENG',
        'Construction / Engineering',
        'Roads, potholes and municipal engineering complaints'
    ),
    (
        'SAN',
        'Sanitation',
        'Garbage, waste collection and sanitation complaints'
    ),
    (
        'LIGHT',
        'Street Light',
        'Street lighting and electrical civic complaints'
    ),
    (
        'CC',
        'Complaint Cell',
        'General civic complaints and coordination'
    )
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- CITIZENS
-- ============================================================

INSERT INTO citizens
(
    name,
    email,
    phone,
    password_hash,
    trust_score,
    is_active,
    email_verified,
    email_verified_at
)
VALUES
(
    'Aarav Joshi',
    'aarav.joshi@example.com',
    '9000000001',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000000',
    80.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Ananya Bisht',
    'ananya.bisht@example.com',
    '9000000002',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000001',
    92.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Rohan Rawat',
    'rohan.rawat@example.com',
    '9000000003',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000002',
    74.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Meera Pant',
    'meera.pant@example.com',
    '9000000004',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000003',
    88.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Aditya Joshi',
    'aditya.joshi@example.com',
    '9000000005',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000004',
    65.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Kavya Rawat',
    'kavya.rawat@example.com',
    '9000000006',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000005',
    95.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Mohit Bisht',
    'mohit.bisht@example.com',
    '9000000007',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000006',
    70.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Neha Tiwari',
    'neha.tiwari@example.com',
    '9000000008',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000007',
    83.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Nitin Mehra',
    'nitin.mehra@example.com',
    '9000000015',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000014',
    68.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Vivek Singh',
    'vivek.singh@example.com',
    '9000000009',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000008',
    77.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Pooja Negi',
    'pooja.negi@example.com',
    '9000000010',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000009',
    90.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Karan Mehta',
    'karan.mehta@example.com',
    '9000000011',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000010',
    60.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Sneha Kandpal',
    'sneha.kandpal@example.com',
    '9000000012',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000011',
    86.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Rahul Bora',
    'rahul.bora@example.com',
    '9000000013',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000012',
    72.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Isha Sharma',
    'isha.sharma@example.com',
    '9000000014',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000013',
    94.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    'Nitin Mehra',
    'nitin.mehra@example.com',
    '90000000015',
    '$2b$12$NagarSetuDemoHash000000000000000000000000000000014',
    68.00,
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;
-- ============================================================
-- EMPLOYEES
-- ============================================================

INSERT INTO employees
    (
        employee_id,
        name,
        email,
        phone,
        password_hash,
        department_id,
        administrative_unit_id,
        is_active
    )

SELECT
    v.employee_id,
    v.name,
    v.email,
    v.phone,
    v.password_hash,
    d.id,
    au.id,
    v.is_active

FROM (
    VALUES

    -- ========================================================
    -- ENGINEERING
    -- ========================================================

    (
        'EMP-ENG-001',
        'Arjun Mehta',
        'arjun.mehta@nagarseu.demo',
        '9100000001',
        '<REAL_BCRYPT_HASH>',
        'ENG',
        'BLOCK-HALDWANI',
        TRUE
    ),

    (
        'EMP-ENG-002',
        'Vikram Bisht',
        'vikram.bisht@nagarseu.demo',
        '9100000002',
        '<REAL_BCRYPT_HASH>',
        'ENG',
        'ULB-NAINITAL',
        TRUE
    ),

    (
        'EMP-ENG-003',
        'Rakesh Rawat',
        'rakesh.rawat@nagarseu.demo',
        '9100000003',
        '<REAL_BCRYPT_HASH>',
        'ENG',
        'BLOCK-RAMNAGAR',
        TRUE
    ),


    -- ========================================================
    -- SANITATION
    -- ========================================================

    (
        'EMP-SAN-001',
        'Sanjay Kumar',
        'sanjay.kumar@nagarseu.demo',
        '9100000004',
        '<REAL_BCRYPT_HASH>',
        'SAN',
        'BLOCK-HALDWANI',
        TRUE
    ),

    (
        'EMP-SAN-002',
        'Deepak Negi',
        'deepak.negi@nagarseu.demo',
        '9100000005',
        '<REAL_BCRYPT_HASH>',
        'SAN',
        'ULB-HALDWANI-KATHGODAM',
        TRUE
    ),


    -- ========================================================
    -- STREET LIGHT
    -- ========================================================

    (
        'EMP-LIGHT-001',
        'Manoj Joshi',
        'manoj.joshi@nagarseu.demo',
        '9100000006',
        '<REAL_BCRYPT_HASH>',
        'LIGHT',
        'ULB-HALDWANI-KATHGODAM',
        TRUE
    ),

    (
        'EMP-LIGHT-002',
        'Naveen Pant',
        'naveen.pant@nagarseu.demo',
        '9100000007',
        '<REAL_BCRYPT_HASH>',
        'LIGHT',
        'ULB-NAINITAL',
        TRUE
    ),


    -- ========================================================
    -- COMPLAINT CELL
    -- ========================================================

    (
        'EMP-CC-001',
        'Priya Sharma',
        'priya.sharma@nagarseu.demo',
        '9100000011',
        '<REAL_BCRYPT_HASH>',
        'CC',
        'DIST-NAINITAL',
        TRUE
    ),


    -- ========================================================
    -- DISTRICT ADMINISTRATION
    -- ========================================================

    (
        'EMP-DIST-001',
        'Neeraj Joshi',
        'neeraj.joshi@nagarseu.demo',
        '9100000012',
        '<REAL_BCRYPT_HASH>',
        NULL,
        'DIST-NAINITAL',
        TRUE
    ),


    -- ========================================================
    -- MUNICIPAL ADMINISTRATION
    -- ========================================================

    (
        'EMP-MUNI-001',
        'Kavita Rawat',
        'kavita.rawat@nagarseu.demo',
        '9100000013',
        '<REAL_BCRYPT_HASH>',
        NULL,
        'ULB-HALDWANI-KATHGODAM',
        TRUE
    ),


    -- ========================================================
    -- SUPER ADMIN
    -- ========================================================

    (
        'EMP-ADMIN-001',
        'System Administrator',
        'admin@nagarseu.demo',
        '9100000014',
        '<REAL_BCRYPT_HASH>',
        NULL,
        NULL,
        TRUE
    )

) AS v(
    employee_id,
    name,
    email,
    phone,
    password_hash,
    department_code,
    administrative_unit_code,
    is_active
)

LEFT JOIN departments d
    ON d.code = v.department_code

LEFT JOIN administrative_units au
    ON au.code = v.administrative_unit_code

ON CONFLICT (employee_id) DO NOTHING;


-- ===============================================================================
UPDATE employees
SET password_hash = CASE employee_id

    -- Engineering Officers
    WHEN 'EMP-ENG-001' THEN '$2b$12$Rxmv6m87bWX5dNhSFGgqEOP.KMKhnvK9vRnGGsO1xZ3hXG8nnmMKS'
    WHEN 'EMP-ENG-002' THEN '$2b$12$Rxmv6m87bWX5dNhSFGgqEOP.KMKhnvK9vRnGGsO1xZ3hXG8nnmMKS'
    WHEN 'EMP-ENG-003' THEN '$2b$12$Rxmv6m87bWX5dNhSFGgqEOP.KMKhnvK9vRnGGsO1xZ3hXG8nnmMKS'

    -- Sanitation Officers
    WHEN 'EMP-SAN-001' THEN '$2b$12$O8dvNTXwX7fURHPkqr83C.3TRh3Pja9TuehEFJziNhoW4wvFPheSq'
    WHEN 'EMP-SAN-002' THEN '$2b$12$O8dvNTXwX7fURHPkqr83C.3TRh3Pja9TuehEFJziNhoW4wvFPheSq'

    -- Street Light Officers
    WHEN 'EMP-LIGHT-001' THEN '$2b$12$6KwpCPmmE0S05.uMtR1y1.fSMCJLaXFnNRkUKpXOqVlroFTCf32P'
    WHEN 'EMP-LIGHT-002' THEN '$2b$12$6KwpCPmmE0S05.uMtR1y1.fSMCJLaXFnNRkUKpXOqVlroFTCf32P'

   
    -- Complaint Cell Supervisor
    WHEN 'EMP-CC-001' THEN '$2b$12$BTHtiExDUUi1o0xajjsA7OD0I91sXVuz5pbA14ENMa37.LeYbMO6W'

    -- District Officer
    WHEN 'EMP-DIST-001' THEN '$2b$12$62hdt4P/s1FYJoBucrlRquPCGNICIlKM.DbkslDqtq8liTVeeyJh'

    -- Municipal Admin
    WHEN 'EMP-MUNI-001' THEN '$2b$12$siUUqS/uScVSJFNdbpQWbe4r3RTLmOQ3dqcCXXIwG8/0KrpO3VaUS'

    -- Super Admin
    WHEN 'EMP-ADMIN-001' THEN '$2b$12$HcnvRnNIBD5CDl3i1s2ps.h1ZjynMTOP1Ut/xNE6iQvAAo6VGyAHG'

END
WHERE employee_id IN (
    'EMP-ENG-001',
    'EMP-ENG-002',
    'EMP-ENG-003',
    'EMP-SAN-001',
    'EMP-SAN-002',
    'EMP-LIGHT-001',
    'EMP-LIGHT-002',
    'EMP-CC-001',
    'EMP-DIST-001',
    'EMP-MUNI-001',
    'EMP-ADMIN-001'
);
-- Demo password mapping (bcrypt-hashed in password_hash column):
--   Engineer@123       → EMP-ENG-001..003
--   Sanitation@123     → EMP-SAN-001..002
--   StreetLight@123    → EMP-LIGHT-001..002=
--   ComplaintCell@123  → EMP-CC-001
--   DistrictOfficer@123→ EMP-DIST-001
--   MunicipalAdmin@123 → EMP-MUNI-001
--   SuperAdmin@123     → EMP-ADMIN-001
-- ============================================================
-- EMPLOYEE ROLES
-- ============================================================

INSERT INTO employee_roles
    (employee_id, role_id)

SELECT
    e.id,
    r.id

FROM employees e
JOIN roles r
    ON r.name =
        CASE e.employee_id

            WHEN 'EMP-ENG-001'   THEN 'officer'
            WHEN 'EMP-ENG-002'   THEN 'officer'
            WHEN 'EMP-ENG-003'   THEN 'officer'

            WHEN 'EMP-SAN-001'   THEN 'officer'
            WHEN 'EMP-SAN-002'   THEN 'officer'

            WHEN 'EMP-LIGHT-001' THEN 'officer'
            WHEN 'EMP-LIGHT-002' THEN 'officer'

            WHEN 'EMP-CC-001'    THEN 'supervisor'

            WHEN 'EMP-DIST-001'  THEN 'district_officer'

            WHEN 'EMP-MUNI-001'  THEN 'municipal_admin'

            WHEN 'EMP-ADMIN-001' THEN 'super_admin'

        END

WHERE e.employee_id IN (
    'EMP-ENG-001',
    'EMP-ENG-002',
    'EMP-ENG-003',
    'EMP-SAN-001',
    'EMP-SAN-002',
    'EMP-LIGHT-001',
    'EMP-LIGHT-002',
    'EMP-CC-001',
    'EMP-DIST-001',
    'EMP-MUNI-001',
    'EMP-ADMIN-001'
)

ON CONFLICT DO NOTHING;

INSERT INTO employee_roles (employee_id, role_id)
SELECT
    e.id,
    r.id
FROM employees e
JOIN roles r
    ON r.name = 'supervisor'
WHERE e.employee_id = 'EMP-CC-001'
ON CONFLICT DO NOTHING;

-- ============================================================
-- COMPLAINT CATEGORIES
-- ============================================================

INSERT INTO complaint_categories
    (code, name, description, is_emergency)
VALUES
    (
        'POTHOLE',
        'Pothole',
        'Pothole or localized road surface damage',
        FALSE
    ),
    (
        'ROAD_DAMAGED',
        'Road Damaged',
        'Damaged or unsafe road condition',
        FALSE
    ),
    (
        'GARBAGE',
        'Garbage',
        'Garbage accumulation or waste collection issue',
        FALSE
    ),
    (
        'STREET_LIGHT',
        'Broken Street Light',
        'Non-functional or damaged street light',
        FALSE
    ),
    (
        'OTHER',
        'Other',
        'Other civic issue requiring complaint-cell coordination',
        FALSE
    )
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- DEPARTMENT ROUTING MAP
-- ============================================================

INSERT INTO department_categories
    (department_id, category_id, priority_weight)
SELECT
    d.id,
    c.id,
    1.0
FROM departments d
CROSS JOIN complaint_categories c
WHERE
    (
        d.code = 'ENG'
        AND c.code IN (
            'POTHOLE',
            'ROAD_DAMAGED'           
        )
    )
    OR (
        d.code = 'SAN'
        AND c.code IN (
            'GARBAGE'
        )
    )
    OR (
        d.code = 'LIGHT'
        AND c.code = 'STREET_LIGHT'
    )
 
    OR (
        d.code = 'CC'
        AND c.code = 'OTHER'
    )
ON CONFLICT (department_id, category_id) DO NOTHING;


-- ============================================================
-- SLA VALUES
-- ============================================================
-- ============================================================
-- COMPLAINT SLA
-- ============================================================

INSERT INTO complaint_sla
    (
        category_id,
        target_hours,
        warning_percentage,
        supervisor_percentage,
        overdue_percentage,
        critical_backlog_percentage
    )

SELECT
    c.id,

    CASE c.code
     
        WHEN 'STREET_LIGHT' THEN 24
        WHEN 'GARBAGE'     THEN 24
        WHEN 'POTHOLE'     THEN 72
        WHEN 'ROAD_DAMAGED' THEN 72
        WHEN 'OTHER'       THEN 72
    END,

    50,     -- Warning at 50% of SLA
    80,     -- Supervisor escalation at 80%
    100,    -- Overdue at 100%
    300     -- Critical backlog at 300%

FROM complaint_categories c

WHERE c.code IN (
    'POTHOLE',
    'ROAD_DAMAGED',
    'GARBAGE',
    'STREET_LIGHT',
    'OTHER'
)

ON CONFLICT (category_id) DO NOTHING;


-- ============================================================
-- ROLES
-- ============================================================

INSERT INTO roles
    (name, description)
VALUES
    (
        'citizen',
        'Citizen who submits and tracks complaints'
    ),
    (
        'officer',
        'Department or field officer who handles complaints'
    ),
    (
        'supervisor',
        'Supervises officers and complaint resolution'
    ),
    (
        'department_head',
        'Head of a municipal department'
    ),
    (
        'block_officer',
        'Block-level administrative officer'
    ),
    (
        'district_officer',
        'District-level administrative officer'
    ),
    (
        'municipal_admin',
        'Municipal administration user'
    ),
    (
        'super_admin',
        'System administrator'
    )
ON CONFLICT (name) DO NOTHING;





-- ============================================================
-- PERMISSIONS
-- ============================================================


INSERT INTO permissions
    (code, description)
VALUES
    ('COMPLAINT_CREATE', 'Create a complaint'),
    ('COMPLAINT_VIEW_OWN', 'View own complaints'),
    ('COMPLAINT_VIEW_PUBLIC', 'View public complaints'),
    ('COMPLAINT_VIEW_DEPARTMENT', 'View department complaints'),
    ('COMPLAINT_VIEW_JURISDICTION', 'View jurisdiction complaints'),
    ('COMPLAINT_ASSIGN', 'Assign complaints'),
    ('COMPLAINT_UPDATE_STATUS', 'Update complaint status'),
    ('COMPLAINT_UPLOAD_RESOLUTION', 'Upload resolution evidence'),
    ('COMPLAINT_VERIFY', 'Verify complaint resolution'),
    ('COMPLAINT_ESCALATE', 'Escalate complaints'),

    ('USER_MANAGE', 'Manage users'),
    ('ROLE_MANAGE', 'Manage roles'),
    ('DEPARTMENT_MANAGE', 'Manage departments'),
    ('CATEGORY_MANAGE', 'Manage categories'),

    ('REPORT_VIEW', 'View reports and analytics'),

    ('BUDGET_VIEW', 'View budget data'),
    ('BUDGET_APPROVE', 'Approve budget'),

    ('FACILITY_MANAGE', 'Manage facilities'),
    ('BOOKING_MANAGE', 'Manage bookings'),
    ('VEHICLE_MANAGE', 'Manage vehicles')

ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- CITIZEN PERMISSIONS
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'citizen'
  AND p.code IN (
      'COMPLAINT_CREATE',
      'COMPLAINT_VIEW_OWN',
      'COMPLAINT_VIEW_PUBLIC'
  )

ON CONFLICT DO NOTHING;



-- ============================================================
-- OFFICER PERMISSIONS
-- ============================================================


INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'officer'
  AND p.code IN (
      'COMPLAINT_VIEW_DEPARTMENT',
      'COMPLAINT_VIEW_JURISDICTION',
      'COMPLAINT_UPDATE_STATUS',
      'COMPLAINT_UPLOAD_RESOLUTION'
  )

ON CONFLICT DO NOTHING;




-- ============================================================
-- SUPERVISOR PERMISSIONS
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'supervisor'
  AND p.code IN (
      'COMPLAINT_VIEW_DEPARTMENT',
      'COMPLAINT_VIEW_JURISDICTION',
      'COMPLAINT_ASSIGN',
      'COMPLAINT_UPDATE_STATUS',
      'COMPLAINT_VERIFY',
      'COMPLAINT_ESCALATE',
      'REPORT_VIEW'
  )

ON CONFLICT DO NOTHING;


INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'supervisor'
  AND p.code = 'COMPLAINT_ASSIGN'
ON CONFLICT DO NOTHING;
-- ============================================================
-- DEPARTMENT HEAD PERMISSIONS
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'department_head'
  AND p.code IN (
      'COMPLAINT_VIEW_DEPARTMENT',
      'COMPLAINT_ASSIGN',
      'COMPLAINT_UPDATE_STATUS',
      'COMPLAINT_VERIFY',
      'COMPLAINT_ESCALATE',
      'REPORT_VIEW',
      'BUDGET_VIEW'
  )

ON CONFLICT DO NOTHING;


-- ============================================================
-- BLOCK OFFICER PERMISSIONS
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'block_officer'
  AND p.code IN (
      'COMPLAINT_VIEW_JURISDICTION',
      'COMPLAINT_ASSIGN',
      'COMPLAINT_UPDATE_STATUS',
      'COMPLAINT_VERIFY',
      'COMPLAINT_ESCALATE',
      'REPORT_VIEW',
      'BUDGET_VIEW'
  )

ON CONFLICT DO NOTHING;


-- ============================================================
-- DISTRICT OFFICER PERMISSIONS
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'district_officer'
  AND p.code IN (
      'COMPLAINT_VIEW_JURISDICTION',
      'COMPLAINT_ASSIGN',
      'COMPLAINT_UPDATE_STATUS',
      'COMPLAINT_VERIFY',
      'COMPLAINT_ESCALATE',
      'REPORT_VIEW',
      'BUDGET_VIEW',
      'BUDGET_APPROVE'
  )

ON CONFLICT DO NOTHING;


-- ============================================================
-- MUNICIPAL ADMIN PERMISSIONS
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'municipal_admin'
  AND p.code IN (
      'COMPLAINT_VIEW_DEPARTMENT',
      'COMPLAINT_VIEW_JURISDICTION',
      'COMPLAINT_ASSIGN',
      'COMPLAINT_UPDATE_STATUS',
      'COMPLAINT_VERIFY',
      'COMPLAINT_ESCALATE',

      'USER_MANAGE',
      'DEPARTMENT_MANAGE',
      'CATEGORY_MANAGE',

      'REPORT_VIEW',

      'BUDGET_VIEW',
      'BUDGET_APPROVE',

      'FACILITY_MANAGE',
      'BOOKING_MANAGE',
      'VEHICLE_MANAGE'
  )

ON CONFLICT DO NOTHING;


-- ============================================================
-- SUPER ADMIN
-- ============================================================

INSERT INTO role_permissions
    (role_id, permission_id)

SELECT
    r.id,
    p.id

FROM roles r
CROSS JOIN permissions p

WHERE r.name = 'super_admin'

ON CONFLICT DO NOTHING;


-- ============================================================
-- COMMENTS / DOCUMENTATION
-- ============================================================

COMMENT ON TABLE administrative_units IS
'Common urban + rural hierarchy for NagarSetu.';

COMMENT ON TABLE complaints IS
'Core civic complaint entity supporting AI classification, routing, priority, duplicate linking and GIS location.';

COMMENT ON TABLE status_history IS
'Complaint status audit trail.';

COMMENT ON TABLE complaint_escalations IS
'Automatic SLA escalation history.';

COMMENT ON TABLE road_segments IS
'Phase 2 predictive-maintenance road model.';

COMMENT ON TABLE complaint_clusters IS
'Phase 2 hotspot clustering output.';

COMMENT ON TABLE trust_score_history IS
'Phase 2 citizen trust-score history.';

COMMENT ON TABLE facilities IS
'Phase 3 civic facility inventory.';

COMMENT ON TABLE bookings IS
'Phase 3 facility bookings.';

COMMENT ON TABLE vehicles IS
'Phase 3 municipal/waste vehicle tracking.';

COMMENT ON TABLE route_logs IS
'Phase 3 append-only vehicle GPS trail.';

COMMENT ON TABLE budget_allocations IS
'Phase 3 department/area budget recommendations and approvals.';

COMMIT;
-- ============================================================
-- QUICK CHECKS
-- ============================================================
--
-- SET search_path TO nagarseu, public;
--
-- SELECT * FROM departments;
-- SELECT * FROM complaint_categories;
-- SELECT * FROM roles;
-- SELECT * FROM permissions;
-- SELECT * FROM v_department_performance;
-- SELECT * FROM v_area_performance;
--
-- Administrative hierarchy:
--
-- WITH RECURSIVE hierarchy AS (
--     SELECT id, name, code, unit_type, parent_id, 1 AS level
--     FROM administrative_units
--     WHERE parent_id IS NULL
--
--     UNION ALL
--
--     SELECT a.id, a.name, a.code, a.unit_type,
--            a.parent_id, h.level + 1
--     FROM administrative_units a
--     JOIN hierarchy h ON a.parent_id = h.id
-- )
-- SELECT *
-- FROM hierarchy
-- ORDER BY level, name;
--
-- ============================================================
