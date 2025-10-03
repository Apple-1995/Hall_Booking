from firebase_admin import firestore
db = firestore.client()
print([doc.to_dict() for doc in db.collection("bookings").where("status", "==", "approved").stream()])
