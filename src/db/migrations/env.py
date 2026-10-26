import asyncio
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Load .env so DATABASE_URL is available
load_dotenv()

config = context.config

# Override sqlalchemy.url from environment
config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL", "postgresql+asyncpg://cortex:cortex@localhost:5432/cortex"),
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so Alembic sees them for autogenerate
from src.db.models import Base  # noqa: E402
from src.db.models.repo import Repo  # noqa: E402, F401
from src.db.models.commit import Commit  # noqa: E402, F401
from src.db.models.file_change import FileChange  # noqa: E402, F401
from src.db.models.file_coupling import FileCoupling  # noqa: E402, F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit migration SQL without connecting to the database."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Run migrations on an existing database connection."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Connect with the async engine and run migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Start the async migration runner."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
