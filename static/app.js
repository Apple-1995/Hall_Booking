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

// ====================== Rooms ======================
async function loadRooms() {
  try {
    const res = await fetch("/rooms");
    const rooms = await res.json();

    const container = document.getElementById("roomsContainer");
    const filter = document.getElementById("roomFilter");

    if (container) container.innerHTML = "";
    if (filter) filter.innerHTML = `<option value="">All Rooms</option>`;

    rooms.forEach(room => {
      if (container) {
        container.innerHTML += `
          <div class="room-card">
            <input type="checkbox" value="${room.name}" id="room-${room.id}">
            <label for="room-${room.id}">${room.name}</label>
          </div>
        `;
      }
      if (filter) {
        filter.innerHTML += `<option value="${room.name}">${room.name}</option>`;
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
    if (data.success) {
      document.getElementById("bookingSuccess").style.display = "inline";
      setTimeout(() => (document.getElementById("bookingSuccess").style.display = "none"), 2000);
    } else {
      alert("Booking failed: " + data.error);
    }
  } catch (err) {
    console.error("Booking error:", err);
  }
});

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
            <button class="error" onclick="rejectBooking('${b.id}')">Reject</button>
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
          <td><button class="error" onclick="deleteBooking('${b.id}')">Delete</button></td>
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

// ====================== Init ======================
loadRooms();
