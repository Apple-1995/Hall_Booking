// ====================== Navigation ======================
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const target = link.getAttribute("data-target");

    document.querySelectorAll(".content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".nav-link").forEach(c => c.classList.remove("active"));

    if (target) {
      document.getElementById(target).classList.add("active");
      link.classList.add("active");
    }
  });
});

// ====================== Load Rooms ======================
async function loadRooms() {
  try {
    const res = await fetch("/rooms");
    const rooms = await res.json();

    const container = document.getElementById("roomsContainer");
    if (container) container.innerHTML = "";

    rooms.forEach(room => {
      if (container) {
        container.innerHTML += `
          <div class="room-card">
            <input type="checkbox" value="${room.name}" id="room-${room.id}">
            <label for="room-${room.id}">${room.name}</label>
          </div>
        `;
      }
    });
  } catch (err) {
    console.error("Error loading rooms:", err);
  }
}

// ====================== Booking Form ======================
document.getElementById("bookingButton")?.addEventListener("click", async () => {
  const selectedRooms = [...document.querySelectorAll("#roomsContainer input:checked")].map(r => r.value);

  const booking = {
    eventName: document.getElementById("eventName").value,
    department: document.getElementById("department").value,
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
    startTime: document.getElementById("startTime").value,
    endTime: document.getElementById("endTime").value,
    participants: document.getElementById("participants").value,
    notes: document.getElementById("notes").value,
    rooms: selectedRooms
  };

  try {
    const res = await fetch("/book", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(booking)
    });
    const data = await res.json();

    const resultBox = document.getElementById("bookingResult");
    if (data.success) {
      resultBox.innerHTML = `
        <div class="success">
          <strong>✅ Booking Submitted!</strong><br>
          Event: ${data.booking.eventName}<br>
          Rooms: ${data.booking.rooms.join(", ")}<br>
          Date: ${data.booking.startDate} → ${data.booking.endDate}<br>
          Time: ${data.booking.startTime} - ${data.booking.endTime}<br>
          Status: Pending approval
        </div>`;
      loadEvents(); // refresh events
      document.getElementById("bookingForm").reset();
    } else {
      resultBox.innerHTML = `
        <div class="error">
          <strong>❌ Booking Failed:</strong> ${data.error}
        </div>`;
    }
  } catch (err) {
    console.error("Booking error:", err);
    document.getElementById("bookingResult").innerHTML = `
      <div class="error">
        <strong>❌ Error submitting booking:</strong> ${err.message}
      </div>`;
  }
});

// ====================== Events ======================
async function loadEvents() {
  try {
    const res = await fetch("/bookings?status=approved");
    const events = await res.json();
    const container = document.getElementById("eventsList");
    container.innerHTML = "";

    events.forEach(ev => {
      container.innerHTML += `
        <div class="event-card">
          <h4>${ev.eventName}</h4>
          <p><strong>Rooms:</strong> ${ev.rooms.join(", ")}</p>
          <p><strong>Date:</strong> ${ev.startDate} → ${ev.endDate}</p>
          <p><strong>Time:</strong> ${ev.startTime} - ${ev.endTime}</p>
          <p><strong>Participants:</strong> ${ev.participants}</p>
          <p><strong>Department:</strong> ${ev.department}</p>
          <p><strong>Notes:</strong> ${ev.notes || "None"}</p>
        </div>
      `;
    });
  } catch (err) {
    console.error("Events error:", err);
  }
}

// ====================== Admin Login ======================
document.getElementById("adminLoginButton")?.addEventListener("click", async () => {
  const username = document.getElementById("adminUsername").value;
  const password = document.getElementById("adminPassword").value;

  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("admin-login").classList.remove("active");
      document.getElementById("admin").classList.add("active");
      document.getElementById("admin-nav").classList.add("active");
      document.getElementById("logout-btn").style.display = "inline";
      loadStats();
      loadPending();
      loadApproved();
    } else {
      document.getElementById("adminLoginError").style.display = "block";
    }
  } catch (err) {
    console.error("Login error:", err);
  }
});

// ====================== Admin Dashboard ======================
async function loadStats() {
  try {
    const res = await fetch("/stats");
    const stats = await res.json();
    document.getElementById("pendingCount").textContent = stats.pending;
    document.getElementById("approvedCount").textContent = stats.approved;
    document.getElementById("totalRooms").textContent = stats.total_rooms;
  } catch (err) {
    console.error("Stats error:", err);
  }
}

async function loadPending() {
  try {
    const res = await fetch("/bookings?status=pending");
    const bookings = await res.json();
    const tbody = document.getElementById("pendingRequests");
    tbody.innerHTML = "";
    bookings.forEach(b => {
      tbody.innerHTML += `
        <tr>
          <td>${b.eventName}</td>
          <td>${b.rooms.join(", ")}</td>
          <td>${b.startDate} → ${b.endDate}</td>
          <td>${b.startTime} - ${b.endTime}</td>
          <td>${b.participants}</td>
          <td>${b.department}</td>
          <td>
            <button onclick="approveBooking('${b.id}')">Approve</button>
            <button class="btn-danger" onclick="rejectBooking('${b.id}')">Reject</button>
          </td>
        </tr>`;
    });
  } catch (err) {
    console.error("Pending error:", err);
  }
}

async function loadApproved() {
  try {
    const res = await fetch("/bookings?status=approved");
    const bookings = await res.json();
    const tbody = document.getElementById("approvedBookings");
    tbody.innerHTML = "";
    bookings.forEach(b => {
      tbody.innerHTML += `
        <tr>
          <td>${b.eventName}</td>
          <td>${b.rooms.join(", ")}</td>
          <td>${b.startDate} → ${b.endDate}</td>
          <td>${b.startTime} - ${b.endTime}</td>
          <td>${b.participants}</td>
          <td>${b.department}</td>
          <td><button class="btn-danger" onclick="deleteBooking('${b.id}')">Delete</button></td>
        </tr>`;
    });
  } catch (err) {
    console.error("Approved error:", err);
  }
}

async function approveBooking(id) {
  await fetch(`/admin/approve/${id}`, {method: "POST"});
  loadPending();
  loadApproved();
}

async function rejectBooking(id) {
  await fetch(`/admin/reject/${id}`, {method: "POST"});
  loadPending();
}

async function deleteBooking(id) {
  await fetch(`/admin/delete/${id}`, {method: "POST"});
  loadApproved();
}

// ====================== Add Room ======================
document.getElementById("addRoomButton")?.addEventListener("click", async () => {
  const name = document.getElementById("newRoomName").value.trim();
  const msg = document.getElementById("addRoomMessage");

  if (!name) {
    msg.textContent = "⚠️ Please enter a room name.";
    msg.style.color = "red";
    return;
  }

  try {
    const res = await fetch("/admin/add-room", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ name })
    });
    const data = await res.json();

    if (data.success) {
      msg.textContent = "✅ Room added successfully!";
      msg.style.color = "green";
      document.getElementById("newRoomName").value = "";
      loadRooms();
      loadStats();
    } else {
      msg.textContent = "❌ Error: " + data.error;
      msg.style.color = "red";
    }
  } catch (err) {
    msg.textContent = "❌ Error: " + err.message;
    msg.style.color = "red";
  }
});

// ====================== Init ======================
loadRooms();
loadEvents();
