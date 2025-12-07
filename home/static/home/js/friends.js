// ===============================
// Friends Modal Logic (FULL UPDATE)
// ===============================

// Elements
const friendsModal = document.getElementById("friendsModal");
const friendsLink = document.getElementById("friends-link");
const friendCountPill = document.getElementById("friends-count-pill");
const closeFriendsBtn = document.getElementById("close-friends-modal");

// Containers
const incomingContainer = document.getElementById("incoming-requests");
const friendsListContainer = document.getElementById("friends-list");
const searchInput = document.getElementById("friend-search-input");
const searchResultsContainer = document.getElementById("friend-search-results");
const modalFriendCount = document.getElementById("friend-count");


// ===============================
// Modal Open / Close
// ===============================

if (friendsLink) {
  friendsLink.addEventListener("click", () => {
    friendsModal.classList.add("show");
    loadFriendData();
  });
}

if (closeFriendsBtn) {
  closeFriendsBtn.addEventListener("click", () => {
    friendsModal.classList.remove("show");
  });
}
// ===============================
// Lightweight Friend Count Loader
// (Used for the profile dropdown pill)
// ===============================
async function loadFriendCountOnly() {
  try {
    const res = await fetch("/api/friends/", { credentials: "same-origin" });
    const data = await res.json();

    // Only update the pill + modal count text
    renderFriendSummary(data.friend_count);

  } catch (err) {
    console.error("Error loading friend count:", err);
  }
}


// ===============================
// Fetch & Render Friends + Requests
// ===============================

async function loadFriendData() {
  try {
    const res = await fetch("/api/friends/", { credentials: "same-origin" });
    const data = await res.json();

    renderFriendSummary(data.friend_count);
    renderIncomingRequests(data.incoming_requests);
    renderFriendsList(data.friends);

  } catch (err) {
    console.error("Error loading friends:", err);
  }
}

function renderFriendSummary(count) {
  modalFriendCount.textContent = count;

  if (count <= 0) {
    friendCountPill.style.display = "none";
  } else {
    friendCountPill.style.display = "inline-flex";
    friendCountPill.textContent = count;
  }
}


// ===============================
// Incoming Friend Requests
// ===============================

function renderIncomingRequests(list) {
  incomingContainer.innerHTML = "";

  if (list.length === 0) {
    incomingContainer.innerHTML =
      `<div style="color:#94a3b8;font-size:0.85rem;">No incoming requests.</div>`;
    return;
  }

  list.forEach(req => {
    const row = document.createElement("div");
    row.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      background:rgba(30,41,59,0.75);padding:8px 12px;border-radius:10px;
    `;

    row.innerHTML = `
      <div style="font-size:0.9rem;color:#e2e8f0;">@${req.from_user}</div>
      <div style="display:flex;gap:8px;">
        <button class="accept-btn"
                data-id="${req.id}"
                style="background:#0f766e;color:white;padding:4px 10px;border-radius:8px;">
          Accept
        </button>
        <button class="reject-btn"
                data-id="${req.id}"
                style="background:#dc2626;color:white;padding:4px 10px;border-radius:8px;">
          Reject
        </button>
      </div>
    `;

    incomingContainer.appendChild(row);
  });

  incomingContainer.querySelectorAll(".accept-btn").forEach(btn =>
    btn.addEventListener("click", () => handleAccept(btn.dataset.id))
  );

  incomingContainer.querySelectorAll(".reject-btn").forEach(btn =>
    btn.addEventListener("click", () => handleReject(btn.dataset.id))
  );
}


// ===============================
// Friends List
// ===============================

function renderFriendsList(list) {
  friendsListContainer.innerHTML = "";

  if (list.length === 0) {
    friendsListContainer.innerHTML =
      `<div style="color:#94a3b8;font-size:0.85rem;">No friends yet.</div>`;
    return;
  }

  list.forEach(friend => {
    const row = document.createElement("div");
    row.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      padding:8px 12px;background:rgba(30,41,59,0.75);
      border-radius:10px;color:#e2e8f0;font-size:0.9rem;
    `;

    row.innerHTML = `
      <div style="display:flex;flex-direction:column;">
        <span style="font-weight:500;">@${friend.username}</span>

        <div style="display:flex;gap:6px;margin-top:4px;">
          <button
            class="view-pins-btn"
            data-username="${friend.username}"
            style="font-size:11px;padding:2px 6px;
                   background:#0ea5e9;color:white;
                   border:1px solid #0284c7;
                   border-radius:6px;">
            View Pins
          </button>

          <button
            class="unfriend-btn"
            data-id="${friend.friendship_id}"
            style="font-size:11px;padding:2px 6px;
                   background:#dc2626;color:white;
                   border-radius:6px;">
            Unfriend
          </button>
        </div>
      </div>
    `;

    friendsListContainer.appendChild(row);

    // Attach handlers
    row.querySelector(".view-pins-btn").addEventListener("click", () => {
      viewFriendPins(friend.username);
    });

    row.querySelector(".unfriend-btn").addEventListener("click", () => {
      unfriend(friend.friendship_id);
    });
  });
}


// ===============================
// Accept / Reject / Remove Friend
// ===============================

async function handleAccept(id) {
  await fetch(`/api/friend-accept/${id}/`, {
    method: "POST",
    headers: { "X-CSRFToken": getCSRF() },
  });
  loadFriendData();
}

async function handleReject(id) {
  await fetch(`/api/friend-reject/${id}/`, {
    method: "POST",
    headers: { "X-CSRFToken": getCSRF() },
  });
  loadFriendData();
}

async function unfriend(id) {
  await fetch(`/api/friend-remove/${id}/`, {
    method: "POST",
    headers: { "X-CSRFToken": getCSRF() },
  });

  // Reload modal data
  loadFriendData();
}


// ===============================
// View Friend Pins — NO ALERT, REAL PIN SWITCH
// ===============================

async function viewFriendPins(username) {
  friendsModal.classList.remove("show");

  try {
    const res = await fetch(`/api/pins/${username}/`, {
      credentials: "same-origin",
    });

    if (!res.ok) {
      console.error("Error loading friend's pins");
      return;
    }

    const data = await res.json();

    // Show pins on globe
    if (window.showPins) {
      showPins(data.pins);
    }

    // Focus map on first pin
    if (data.pins.length > 0 && window.moveCameraTo) {
      const p = data.pins[0];
      moveCameraTo(p.lat, p.lon);
    }

  } catch (err) {
    console.error("Error viewing friend pins:", err);
  }
}


// ===============================
// Search Users (Debounced)
// ===============================

let searchTimeout = null;

if (searchInput) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    const q = searchInput.value.trim();
    if (!q) {
      searchResultsContainer.innerHTML = "";
      return;
    }

    searchTimeout = setTimeout(() => {
      searchUsers(q);
    }, 300);
  });
}

async function searchUsers(query) {
  try {
    const res = await fetch(`/api/friends/search/?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderSearchResults(data.results);

  } catch (err) {
    console.error("Search error:", err);
  }
}

function renderSearchResults(list) {
  searchResultsContainer.innerHTML = "";

  if (list.length === 0) {
    searchResultsContainer.innerHTML =
      `<div style="color:#94a3b8;font-size:0.85rem;">No users found.</div>`;
    return;
  }

  list.forEach(user => {
    const row = document.createElement("div");

    row.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      padding:8px 12px;background:rgba(30,41,59,0.75);
      border-radius:10px;font-size:0.9rem;color:#e2e8f0;
    `;

    row.innerHTML = `
      <div>@${user.username}</div>
      <button class="add-friend-btn"
              data-username="${user.username}"
              style="background:#0ea5e9;color:white;
                     padding:4px 10px;border-radius:8px;">
        Add Friend
      </button>
    `;

    searchResultsContainer.appendChild(row);
  });

  searchResultsContainer.querySelectorAll(".add-friend-btn").forEach(btn =>
    btn.addEventListener("click", () => sendFriendRequest(btn))
  );
}


// ===============================
// Send Friend Request
// ===============================

async function sendFriendRequest(btn) {
  const username = btn.dataset.username;

  btn.disabled = true;
  btn.textContent = "Requested";

  try {
    await fetch(`/api/friend-request/${username}/`, {
      method: "POST",
      headers: { "X-CSRFToken": getCSRF() },
    });

    loadFriendData();

  } catch (err) {
    console.error("Friend request failed:", err);
  }
}


// ===============================
// Helper — Get CSRF token
// ===============================

function getCSRF() {
  const cookie = document.cookie.split("; ").find(r => r.startsWith("csrftoken="));
  return cookie ? cookie.split("=")[1] : "";
}


// Load friend count immediately on page load
document.addEventListener("DOMContentLoaded", () => {
  if (friendCountPill) {
    loadFriendCountOnly();
  }
});