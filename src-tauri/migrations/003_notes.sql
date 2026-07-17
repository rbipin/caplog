CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);

INSERT INTO notes (id, content, updated_at) VALUES (1, '', NULL);
