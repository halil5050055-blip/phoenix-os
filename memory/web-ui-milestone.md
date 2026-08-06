# Web UI Milestone

Phoenix BOS serves its first web interface from the existing Express application and deployment. The implementation deliberately uses dependency-free HTML, CSS, and JavaScript because the milestone only needs login and a dashboard shell; no separate frontend build or service is warranted.

Browser authentication reuses the canonical JWT. Login places it in an HTTP-only, `SameSite=Strict` cookie that is marked `Secure` in production, while API and Telegram clients retain Bearer-token support. Frontend JavaScript never reads the token, and logout revokes the JWT before clearing the cookie.

The dashboard route authenticates on the server and redirects an unauthenticated browser to `/login`. CRM screens, AI features, and additional services remain explicitly deferred.
