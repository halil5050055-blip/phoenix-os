# Website

`public/` contains the dependency-free Phoenix BOS login page and dashboard shell served by the existing Express application. HTML is delivered by explicit web routes, while CSS and JavaScript are exposed under `/assets`.

The web UI uses the canonical backend API and does not contain business logic. Browser authentication reuses the backend JWT in an HTTP-only session cookie; frontend JavaScript cannot read the token.
