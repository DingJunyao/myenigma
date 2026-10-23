# Static web demo: Pyodide + myenigma run entirely in the browser.
# No Python is executed on the server, so a plain file server is enough.
FROM python:3.10-slim

WORKDIR /app
COPY webapp /app

EXPOSE 8080

CMD ["python", "-m", "http.server", "8080", "--directory", "/app"]
