SELECT * FROM users;

SELECT * FROM notes;

SELECT 
    notes.id,
    notes.title,
    users.username
FROM notes
JOIN users ON notes.user_id = users.id;

SELECT * FROM note_links;