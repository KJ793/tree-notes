CREATE EXTENSION IF NOT EXISTS pgcrypto;





/* ========================================================
   USERS
======================================================== */

CREATE TABLE users (

    id BIGSERIAL PRIMARY KEY,

    username VARCHAR(50) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);





/* ========================================================
   NOTES
======================================================== */

CREATE TABLE notes (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,

    cue_section TEXT,

    notes_section TEXT,

    summary_section TEXT,

    is_node BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id
ON notes(user_id);





/* ========================================================
   NOTE_LINKS
======================================================== */

CREATE TABLE note_links (

    id BIGSERIAL PRIMARY KEY,

    note_a_id BIGINT NOT NULL
        REFERENCES notes(id)
        ON DELETE CASCADE,

    note_b_id BIGINT NOT NULL
        REFERENCES notes(id)
        ON DELETE CASCADE,

    relationship_type VARCHAR(50) NOT NULL,

    strength NUMERIC(4,3) NOT NULL
        CHECK (
            strength >= 0
            AND strength <= 1
        ),

    label VARCHAR(255),

    ai_generated BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_note_pair
        UNIQUE(note_a_id, note_b_id),

    CONSTRAINT check_note_order
        CHECK(note_a_id < note_b_id)
);

CREATE INDEX idx_note_links_a
ON note_links(note_a_id);

CREATE INDEX idx_note_links_b
ON note_links(note_b_id);





/* ========================================================
   AI_SUGGESTIONS
======================================================== */

CREATE TABLE ai_suggestions (

    id BIGSERIAL PRIMARY KEY,

    source_note_id BIGINT NOT NULL
        REFERENCES notes(id)
        ON DELETE CASCADE,

    target_note_id BIGINT NOT NULL
        REFERENCES notes(id)
        ON DELETE CASCADE,

    reasoning TEXT,

    confidence_score NUMERIC(4,3) NOT NULL
        CHECK (
            confidence_score >= 0
            AND confidence_score <= 1
        ),

    status VARCHAR(20) NOT NULL
        CHECK (
            status IN (
                'pending',
                'accepted',
                'rejected'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_ai_suggestion
        UNIQUE(source_note_id, target_note_id)
);

CREATE INDEX idx_ai_source
ON ai_suggestions(source_note_id);

CREATE INDEX idx_ai_target
ON ai_suggestions(target_note_id);

CREATE INDEX idx_ai_status
ON ai_suggestions(status);