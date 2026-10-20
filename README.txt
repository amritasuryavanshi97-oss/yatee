AICTE Activity Tracker — fixed demo version

FILES
- index.html
- style.css
- script.js
- aicteactivity.java

REQUIREMENTS
- JDK 17 or newer recommended.
- A browser.

DEMO ACCOUNTS
- username: aditi, password: demo123
- username: student2, password: demo123

RUN
1. Keep all four files in one folder.
2. Open a terminal/command prompt in that folder.
3. Compile: javac aicteactivity.java
4. Start backend: java aicteactivity
5. Open index.html in your browser. If direct file opening causes browser restrictions, use a local static server (for example VS Code Live Server). The Java backend remains at http://localhost:8080.
6. Log in using one of the demo accounts.

BEHAVIOUR
- Each student starts with 75 points.
- Each accepted check-in adds 5 points, capped at 100.
- One check-in per student per local calendar day.
- Check-in history and counts are saved in aicte-data.properties file in the backend working directory.
- Login tokens are in memory and become invalid when the Java server restarts; log in again after restart.

IMPORTANT DEMO LIMITATIONS
- Credentials are hardcoded in source code and passwords are not hashed. This is for a local classroom demonstration only, not deployment.
- CORS currently allows any origin for ease of local development.
- Do not expose this server to the public internet. For production, use password hashing, a persistent user database, HTTPS, secure session/token expiry, rate limiting, CSRF/security controls as appropriate, and restricted CORS.
