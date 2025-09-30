# CON Hall Booking (Flask + Firebase)

## Deploy (Render/Heroku)
1. Create Firebase project → Firestore enabled.
2. Generate **Service Account JSON** and set it as env var:
   - `FIREBASE_CREDENTIALS` = (paste JSON)
   - or `FIREBASE_CREDENTIALS_B64` = base64 of the JSON
3. Also set:
   - `ADMIN_USER` (default: admin)
   - `ADMIN_PASS` (default: con123)
4. Install + run:
   ```bash
   pip install -r requirements.txt
   gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker app:app
   ```

## Endpoints
- `GET /` -> UI
- `GET /rooms?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&startTime=HH:MM&endTime=HH:MM`
- `POST /book` -> create booking
- `GET /bookings?status=approved|pending|rejected&room=NAME&date=YYYY-MM-DD`
- `POST /admin/login` (JSON: username, password)
- `POST /admin/approve/<id>`
- `POST /admin/reject/<id>`
- `POST /admin/delete/<id>`
- `POST /admin/add-room` (JSON: name)
- `GET /stats`
