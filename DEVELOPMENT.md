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

## Accessing Ollama Models via Docker

### How it works
**Goal:** Have two separate Docker container: 1 for the backend server; 1 for the ollama.

Ideally, all team members would have Nvidia and the Nvidia Container Toolkit, plus Ollama service. Having two containers avoids this requirement however, and if you don't have Nvidia hardware, you can still develop on the system without needing to run the second Ollama container.

### Requirements
1. NVIDIA GPU
2. NVIDIA Container Toolkit (installed). For Linux:
```bash
sudo apt-get install -y nvidia-container-toolkit
```
3. Ensure your *docker-compose.yml* file is updated to include Ollama service components, volumes, and requirements (as per GitHub push)
4. The Dockerfile is fine as is, the backend container will simply call: "http://ollama:11434" and we don't need to make any adjustments here.

### Have your Docker include Ollama

First, make sure your Ollama service is turned off.
For Linux:
```bash
sudo systemctl disable ollama
```
and verify with
```bash
sudo systemctl status ollama
```

Next, ensure your *docker-compose.yml* file is up to date with Ollama-relevant code. **NOTE:** YAML files use spaces -> DO NOT use Tabs as these will cause parsing errors during compilation.

Then, run

```bash
docker compose up --build
```
and this should create your two containers. You can confirm using `docker ps` and multiple containers should appear, including one called "treenotes_ollama".

We must provide instruction to the the Nvidia Container Toolkit to run inside docker. For Linux:

```bash
sudo nvidia-ctk runtime configure --runtime=docker
```

Restart Docker:

```bash
sudo systemctl restart docker
```

**Important**: To confirm GPU passthrough via the Toolkit on Linux:
```bash
docker run --rm --gpus all nvidia/cuda:<version> nvidia-smi
```

This command should give you the GPU/s visible via Docker, their Driver, and their CUDA if available. If no GPU's listed, you've got a problem. Make sure your GPU is being used by your system in general.

Now that your docker compose has a separate Ollama Container with GPU access via NVIDIA's toolkit, we can build the docker stack:

```bash
docker compose up --build
```

this will start the entire application, backend, frontend, postgres, pgadmin, and the GPU container.

Now that the full docker stack is running, we can install the AI Model of your choice:
```bash
docker exec -it treenotes_ollama ollama pull qwen2.5-coder:14b
docker exec -it treenotes_ollama ollama pull qwen2.5-coder
```
- Replace "qwen2.5-coder:14b" or "qwen2.5-coder" with the model of your choice. Keep in mind the size of your GPU; make sure to leave a few GB for runtime overhead.
- In this case, we are using two different models for two different situations:
1. If your system does not have an NVIDIA GPU, or your NVIDIA GPU is no more than 8GB VRAM, it is recommended that you only implement qwen2.5-coder, with an approximate size of 4.7GB, which should leave ample room for runtime overhead.
2. If your system has an NVIDIA GPU with at least 12GB VRAM, the larger qwen2.5-coder:14b model will provide better responses and consume over 9GB of your VRAM, so having at least 12GB will leave you with runtime overhead capacity.

*Side Note:* the command "ollama pull <model_name>" is how you install your model via the Ollama service directly on your machine. The part "docker exec -it" says this is a command you want to run inside docker, "treenotes_ollama" is specific to in which container to run the command, and the final part is the command you want to run inside that docker container. In our case, we want ollama to pull (download) a model into our docker container.

To confirm your docker container has the model stored:
```bash
docker exec -it treenotes_ollama ollama list
```
You should see something like:
|NAME | ID | SIZE | MODIFIED|
| ----------------| ----------- | -------------- | --------------|
|qwen2.5-coder:latest | dae161e27b0e | 4.7 GB | 2 minutes ago |
|qwen2.5-coder:14b | 61819fb370a3 | 9.0 GB | 3 minutes ago |

To confirm everything is running correctly, run:
```bash
docker ps
```
This should give you all the active containers, including one called **treenotes_ollama** and its active port **11434**.

### Important!!!
* Go to the tree-notes/backend/ai/ai.py file, On line **10-11**, you must comment out the `ollama_model` variable that you are not using. By default, the application uses the 14b version, so if you decide to not use this version, please swap the comments.

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
