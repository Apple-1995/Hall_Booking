import os
import json
import base64
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
import firebase_admin
from firebase_admin import credentials, firestore
from google.api_core.exceptions import FailedPrecondition

# ----------------- Flask & SocketIO -----------------
app = Flask(__name__, template_folder="templates", static_folder="static")
socketio = SocketIO(app, cors_allowed_origins="*")

# ----------------- Admin credentials -----------------
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "con123")

# ----------------- Firebase Init -----------------
cred_data = None
if os.environ.get("FIREBASE_CREDENTIALS_B64"):
    try:
        cred_json = base64.b64decode(os.environ["FIREBASE_CREDENTIALS_B64"]).decode("utf-8")
        cred_data = json.loads(cred_json)
    except Exception as e:
        raise RuntimeError(f"❌ Invalid FIREBASE_CREDENTIALS_B64: {e}")

if not cred_data:
    raise RuntimeError("❌ Missing FIREBASE_CREDENTIALS_B64 environment variable")

cred = credentials.Certificate(cred_data)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ----------------- Default Rooms -----------------
DEFAULT_ROOMS = [
    "CSSE Conference Hall 1",
    "CSSE Conference Hall 2",
    "ARES",
    "OSCE",
    "Board Room",
    "Medical Surgical Skill Lab",
    "Maternal Nursing Skill Lab",
    "Child Health Skill Lab",
    "Skill Station 1",
    "Skill Station 2"
]

def ensure_default_rooms():
    try:
        rooms_ref = db.collection("rooms")
        existing = [r.to_dict().get("name") for r in rooms_ref.stream()]
        for room in DEFAULT_ROOMS:
            if room not in existing:
                rooms_ref.document().set({"name": room, "available": True})
        print(f"✅ Default rooms ensured: {len(DEFAULT_ROOMS)}")
    except Exception as e:
        print("⚠️ Could not ensure default rooms:", e)

ensure_default_rooms()

# ----------------- Helpers -----------------
def check_room_availability(rooms, start_date, end_date, start_time, end_time):
    """Check if selected rooms are available in the given date & time range."""
    if not rooms:
        return False, "No rooms selected"
    try:
        query = (
            db.collection("bookings")
            .where("rooms", "array_contains_any", rooms)
            .where("status", "==", "approved")
            .where("startDate", "<=", end_date)
            .where("endDate", ">=", start_date)
            .limit(20)  # ✅ limit to avoid timeouts
        )
        overlapping_bookings = query.stream()
        for booking in overlapping_bookings:
            b = booking.to_dict()
            if not (end_time <= b.get("startTime") or start_time >= b.get("endTime")):
                return False, f"Room(s) {', '.join(rooms)} already booked for overlapping time"
        return True, "Available"
    except FailedPrecondition as e:
        return False, f"Database index missing: {str(e)}"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"

def count_query(q):
    """Count documents in a query safely (returns int)."""
    try:
        agg = q.count()
        res = list(agg.stream())
        return res[0][0].value if res else 0
    except Exception:
        return 0

# ----------------- Routes -----------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/rooms", methods=["GET"])
def get_rooms():
    try:
        start_date = request.args.get("startDate")
        end_date = request.args.get("endDate")
        start_time = request.args.get("startTime")
        end_time = request.args.get("endTime")

        rooms_stream = db.collection("rooms").stream()
        rooms = []
        for r in rooms_stream:
            doc = r.to_dict()
            doc["id"] = r.id
            doc.setdefault("available", True)

            if start_date and end_date and start_time and end_time:
                available, _ = check_room_availability(
                    [doc["name"]], start_date, end_date, start_time, end_time
                )
                doc["available"] = available
            rooms.append(doc)
        return jsonify(rooms)
    except Exception as e:
        print("❌ Error in /rooms:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/book", methods=["POST"])
def book_room():
    try:
        data = request.json or {}
        required = ["eventName","rooms","startDate","endDate","startTime","endTime","participants","department"]
        missing = [k for k in required if not data.get(k)]
        if missing:
            return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

        available, message = check_room_availability(
            data.get("rooms", []),
            data.get("startDate"),
            data.get("endDate"),
            data.get("startTime"),
            data.get("endTime"),
        )
        if not available:
            return jsonify({"success": False, "error": message}), 400

        doc_ref = db.collection("bookings").document()
        booking = {
            "eventName": data.get("eventName"),
            "rooms": data.get("rooms", []),
            "startDate": data.get("startDate"),
            "endDate": data.get("endDate"),
            "startTime": data.get("startTime"),
            "endTime": data.get("endTime"),
            "participants": int(data.get("participants", 1)),
            "department": data.get("department"),
            "notes": data.get("notes", ""),
            "status": "pending",
            "createdAt": datetime.now().isoformat()
        }
        doc_ref.set(booking)
        socketio.emit("update_events")
        return jsonify({"success": True, "id": doc_ref.id, "booking": booking})
    except Exception as e:
        print("❌ Error in /book:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/bookings", methods=["GET"])
def list_bookings():
    try:
        status = request.args.get("status")
        room = request.args.get("room")
        date = request.args.get("date")

        q = db.collection("bookings")
        if status:
            q = q.where("status", "==", status)

        docs = q.stream()
        results = []
        for d in docs:
            b = d.to_dict()
            if room and room not in b.get("rooms", []):
                continue
            if date and not (b.get("startDate") <= date <= b.get("endDate")):
                continue
            b["id"] = d.id
            results.append(b)

        results.sort(key=lambda x: (x.get("startDate", ""), x.get("startTime", "")))
        return jsonify(results)
    except Exception as e:
        print("❌ Error in /bookings:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/admin/login", methods=["POST"])
def admin_login():
    try:
        data = request.json or {}
        if data.get("username") == ADMIN_USER and data.get("password") == ADMIN_PASS:
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "Invalid credentials"}), 401
    except Exception as e:
        print("❌ Error in /admin/login:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/admin/approve/<booking_id>", methods=["POST"])
def approve_booking(booking_id):
    try:
        db.collection("bookings").document(booking_id).update({"status": "approved"})
        socketio.emit("update_events")
        return jsonify({"success": True})
    except Exception as e:
        print("❌ Error in approve:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/admin/reject/<booking_id>", methods=["POST"])
def reject_booking(booking_id):
    try:
        db.collection("bookings").document(booking_id).update({"status": "rejected"})
        socketio.emit("update_events")
        return jsonify({"success": True})
    except Exception as e:
        print("❌ Error in reject:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/admin/delete/<booking_id>", methods=["POST"])
def delete_booking(booking_id):
    try:
        db.collection("bookings").document(booking_id).delete()
        socketio.emit("update_events")
        return jsonify({"success": True})
    except Exception as e:
        print("❌ Error in delete:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/admin/add-room", methods=["POST"])
def add_room():
    try:
        data = request.json or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"success": False, "error": "Room name required"}), 400

        existing = list(db.collection("rooms").where("name", "==", name).stream())
        if existing:
            return jsonify({"success": False, "error": "Room already exists"}), 409

        db.collection("rooms").document().set({"name": name, "available": True})
        socketio.emit("update_events")
        return jsonify({"success": True})
    except Exception as e:
        print("❌ Error in add-room:", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        pending = count_query(db.collection("bookings").where("status", "==", "pending"))
        approved = count_query(db.collection("bookings").where("status", "==", "approved"))
        total_rooms = count_query(db.collection("rooms"))
        return jsonify({"pending": pending, "approved": approved, "total_rooms": total_rooms})
    except Exception as e:
        print("❌ Error in /stats:", e)
        return jsonify({"success": False, "error": str(e)}), 500

# ----------------- Run App -----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port)
