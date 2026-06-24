FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency manifests first for better layer caching
COPY pyproject.toml uv.lock ./

# Install production dependencies from the frozen lockfile
RUN uv sync --frozen --no-dev

# Copy application source
COPY . .

# Create a non-root user and hand over ownership
RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /app

# Make the entrypoint executable before dropping privileges
RUN chmod +x /app/entrypoint.sh

USER appuser

EXPOSE 8000

# Use explicit shell invocation so the script doesn't need execute permission
# on the host-mounted volume (which would override the build-time chmod).
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
