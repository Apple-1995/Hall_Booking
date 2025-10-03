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
      if (target === "events") renderEvents();
    }
  });
});

// ====================== Socket.IO live updates ======================
let socket;
try {
  socket = io();
  socket.on("update_events", () => {
    loadRooms();
    loadStats();
    loadPending();
    loadApproved();
    renderEvents();
  });
} catch (e) {
  console.warn("Socket.IO not connected:", e);
}

// ====================== Rooms ======================
async function loadRooms() {
  try {
    const res = await fetch("/rooms");
    const rooms = await res.json();
    const container = document.getElementById("roomsContainer");
    if (container) container.innerHTML = "";
    rooms.forEach(room => {
      container.innerHTML += `
        <div class="room-card">
          <input type="checkbox" value="${room.name}" id="room-${room.id}">
          <label for="room-${room.id}">${room.name}</label>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error loading rooms:", err);
  }
}

// ====================== Booking ======================
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

  const resultDiv = document.getElementById("bookingResult");
  resultDiv.innerHTML = "";

  try {
    const res = await fetch("/book", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(booking)
    });
    const data = await res.json();

    if (data.success) {
      resultDiv.innerHTML = `
        <p class="success">✅ Booking submitted successfully!</p>
        <ul>
          <li><strong>Event:</strong> ${booking.eventName}</li>
          <li><strong>Department:</strong> ${booking.department}</li>
          <li><strong>Date:</strong> ${booking.startDate} → ${booking.endDate}</li>
          <li><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</li>
          <li><strong>Rooms:</strong> ${booking.rooms.join(", ")}</li>
          <li><strong>Participants:</strong> ${booking.participants}</li>
          <li><strong>Notes:</strong> ${booking.notes}</li>
        </ul>
      `;
      document.getElementById("bookingForm").reset();
    } else {
      resultDiv.innerHTML = `<p class="error">❌ Error: ${data.error || "Unknown error"}</p>`;
    }
  } catch (err) {
    console.error("Booking error:", err);
    resultDiv.innerHTML = `<p class="error">❌ Request failed: ${err.message}</p>`;
  }
});

// ====================== Events ======================
async function renderEvents() {
  try {
    const res = await fetch("/bookings?status=approved");
    const bookings = await res.json();
    const container = document.getElementById("eventsList");
    container.innerHTML = "";
    if (bookings.length === 0) {
      container.innerHTML = "<p>No approved events yet.</p>";
      return;
    }
    bookings.forEach(b => {
      container.innerHTML += `
        <div class="event-card">
          <h4>${b.eventName}</h4>
          <p><strong>Rooms:</strong> ${b.rooms.join(", ")}</p>
          <p><strong>Date:</strong> ${b.startDate} → ${b.endDate}</p>
          <p><strong>Time:</strong> ${b.startTime} - ${b.endTime}</p>
          <p><strong>Department:</strong> ${b.department} (${b.participants} participants)</p>
        </div>
      `;
    });
  } catch (err) {
    console.error("Error loading events:", err);
  }
}

// ====================== Admin ======================
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
      document.getElementById("admin-nav").style.display = "inline";
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

document.getElementById("logout-btn")?.addEventListener("click", () => {
  document.getElementById("admin").classList.remove("active");
  document.getElementById("admin-login").classList.add("active");
  document.getElementById("admin-nav").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
});

// ====================== Admin Dashboard ======================
async function loadStats() {
  try {
    const res = await fetch("/stats");
    const stats = await res.json();
    document.getElementById("pendingCount").textContent = stats.pending ?? 0;
    document.getElementById("approvedCount").textContent = stats.approved ?? 0;
    document.getElementById("totalRooms").textContent = stats.total_rooms ?? 0;
  } catch (err) { console.error("Stats error:", err); }
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
            <button class="error" onclick="rejectBooking('${b.id}')">Reject</button>
          </td>
        </tr>`;
    });
  } catch (err) { console.error("Pending error:", err); }
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
          <td><button class="error" onclick="deleteBooking('${b.id}')">Delete</button></td>
        </tr>`;
    });
  } catch (err) { console.error("Approved error:", err); }
}

async function approveBooking(id) { await fetch(`/admin/approve/${id}`, {method:"POST"}); loadPending(); loadApproved(); }
async function rejectBooking(id) { await fetch(`/admin/reject/${id}`, {method:"POST"}); loadPending(); }
async function deleteBooking(id) { await fetch(`/admin/delete/${id}`, {method:"POST"}); loadApproved(); }

// ====================== Init ======================
loadRooms();
