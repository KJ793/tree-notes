# TreeNotes - Development Setup Guide

This guide will get the full TreeNotes development environment running on your machine. You do not need to install Python, PostgreSQL, or any other dependencies manually. Everything runs inside Docker.

---

## Prerequisites

The only thing you need to install is **Docker Desktop**:
- Download it here: https://www.docker.com/products/docker-desktop
- Once installed, open Docker Desktop and wait until it says **"Docker Desktop is running"** in the system tray

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/KJ793/tree-notes.git
cd tree-notes
```

### 2. Switch to the dev branch
```bash
git checkout dev
```

### 3. Set up your environment variables
```bash
cp .env.example .env
```
You do not need to change anything in `.env` for local development. The default values will work out of the box.

### 4. Start everything
```bash
docker compose up -d
```
This will start four services:
| Service | What it is | Where to access it |
|---------|-----------|-------------------|
| Frontend | HTML/CSS/JS served by Nginx | http://localhost:8080 |
| Backend | FastAPI (Python) | http://localhost:8000 |
| Database | PostgreSQL | http://localhost:5432 |
| pgAdmin | Database browser UI | http://localhost:5050 |

### 5. Set up the database
Run this once after your first `docker compose up`:
```bash
docker compose run backend alembic upgrade head
```
This creates all the database tables. You only need to do this once, or any time a new migration is added.

---

## Stopping the Project
```bash
docker compose down
```
This stops all containers but keeps your database data intact.

If you want to stop everything AND wipe the database:
```bash
docker compose down -v
```
The `-v` flag deletes all data. Only use this if you want a completely fresh start.

---

## Accessing pgAdmin (Database Browser)
pgAdmin lets you visually browse the database. Useful for checking your data during development.

1. Go to http://localhost:5050
2. Log in with:
   - **Email:** `admin@treenotes.com`
   - **Password:** `admin`
3. To connect to the database, right click **Servers → Register → Server** and fill in:
   - **Name:** `TreeNotes`
   - **Host:** `db`
   - **Port:** `5432`
   - **Database:** `treenotes_db`
   - **Username:** `treenotes_user`
   - **Password:** `changeme`

---

## For the Database & DevOps Role

### Running migrations
Any time the database schema changes, a new migration file will be added to `backend/migrations/versions/`. To apply it:
```bash
docker compose run backend alembic upgrade head
```

### Creating a new migration
If you make changes to `backend/models.py`, generate a new migration with:
```bash
docker compose run backend alembic revision --autogenerate -m "describe your change here"
```
Then apply it:
```bash
docker compose run backend alembic upgrade head
```

### Rolling back a migration
To undo the last migration:
```bash
docker compose run backend alembic downgrade -1
```

### Checking migration status
To see which migrations have been applied:
```bash
docker compose run backend alembic current
```

To see the full migration history:
```bash
docker compose run backend alembic history
```

---

## Troubleshooting

**`docker compose up -d` fails with "port already in use"**
Something on your machine is already using that port. Either stop that process or change the port in `docker-compose.yml`.

**Database tables don't exist**
You probably haven't run the migrations yet. Run:
```bash
docker compose run backend alembic upgrade head
```

**I want to completely reset everything**
```bash
docker compose down -v
docker compose up -d
docker compose run backend alembic upgrade head
```
