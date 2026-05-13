/* ========================================================
   USERS
======================================================== */

INSERT INTO users (username, email, password_hash)
VALUES
('alice', 'alice@example.com', 'hash_alice'),
('bob', 'bob@example.com', 'hash_bob'),
('carol', 'carol@example.com', 'hash_carol');





/* ========================================================
   NOTES
======================================================== */

INSERT INTO notes (user_id, title, cue_section, notes_section, summary_section, is_node)
VALUES

-- Alice notes
(1, 'SQL Basics', 'What is SQL?', 'SQL is a query language for databases.', 'Intro to SQL', TRUE),
(1, 'Docker Intro', 'What is Docker?', 'Docker is containerization platform.', 'Docker basics', TRUE),

-- Bob notes
(2, 'PostgreSQL Index', 'Why indexes?', 'Indexes speed up queries.', 'Indexing concept', TRUE),
(2, 'Normalization', 'What is normalization?', 'Organizing database to reduce redundancy.', 'DB design concept', TRUE),

-- Carol notes
(3, 'AI Notes Idea', 'How to use AI?', 'AI can suggest related notes.', 'AI feature idea', TRUE);





/* ========================================================
   NOTE_LINKS
======================================================== */

INSERT INTO note_links (note_a_id, note_b_id, relationship_type, strength, label, ai_generated)
VALUES

-- SQL Basics <-> PostgreSQL Index
(1, 3, 'related', 0.85, 'SQL + Indexing', FALSE),

-- SQL Basics <-> Normalization
(1, 4, 'related', 0.80, 'DB fundamentals', FALSE),

-- Docker Intro <-> AI Notes Idea
(2, 5, 'related', 0.60, 'infra + AI', TRUE);





/* ========================================================
   AI_SUGGESTIONS
======================================================== */

INSERT INTO ai_suggestions (source_note_id, target_note_id, reasoning, confidence_score, status)
VALUES

(1, 3,
 'SQL Basics is strongly related to indexing concepts.',
 0.92,
 'accepted'),

(1, 4,
 'Normalization is fundamental to SQL understanding.',
 0.88,
 'pending'),

(2, 5,
 'Docker environment can support AI note systems.',
 0.70,
 'pending'),

(3, 1,
 'AI Notes Idea connects back to SQL structure.',
 0.65,
 'rejected');