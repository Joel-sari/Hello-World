// home/static/home/js/pin_modals.js
// ------------------------------------------------------
// Handles Add/Edit Pin modal + AJAX POST submission
// Now includes smooth fade-in / fade-out transitions
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("pinModal");
  const addBtn = document.getElementById("addPinBtn");
  const closeBtn = document.getElementById("closeModal");
  const form = document.getElementById("pinForm");

  let mode = "add";
  let currentPinId = null;

  // 🔥 Helper: Smoothly open modal
  function openModal() {
    // Remove hidden state first
    modal.classList.remove("hidden");

    // Force a layout reflow so the transition applies correctly
    void modal.offsetWidth;

    // Add visible state
    modal.classList.add("modal-visible");
  }

  /* Helper: Smoothly close modal */
  function closeModal() {
    // Start fade-out
    modal.classList.remove("modal-visible");

    // After transition ends, hide it fully
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 250); // match CSS transition time
  }
  // OPEN ADD PIN MODAL
  if (addBtn) {
    addBtn.onclick = () => {
      mode = "add";
      currentPinId = null;
      form.reset();
      openModal(); // smooth open
    };
  }

  // CLOSE MODAL
  if (closeBtn) {
    closeBtn.onclick = () => closeModal(); // smooth close
  }

  // SUBMIT FORM
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    let url = window.ADD_PIN_URL; // "/api/add-pin/"
    if (mode === "edit" && currentPinId) {
      url = `${window.EDIT_PIN_BASE_URL}${currentPinId}/`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")
          .value,
        "X-Requested-With": "XMLHttpRequest", // required for Django AJAX
      },
      body: formData,
    });

    if (!res.ok) {
      console.error("Save pin error:", res);
      alert("Failed to save pin");
      return;
    }

    const data = await res.json();

    closeModal(); // smooth fade-out
    form.reset();

    if (window.addPinToGlobe) {
      window.addPinToGlobe(data);
    } else {
      window.location.reload();
    }
  });

  // OPEN EDIT PIN MODAL
  window.openEditModal = async function (pinId) {
    // Close details modal if open
    const details = document.getElementById("pinDetailsModal");
    if (details) {
      details.classList.remove("show");
      details.classList.add("hidden");
    }

    if (typeof hideReactionPopup === "function") hideReactionPopup();

    currentPinId = pinId;
    mode = "edit";

    const res = await fetch(`/api/pin/${pinId}/`);
    if (!res.ok) {
      alert("Failed to load pin");
      return;
    }

    const data = await res.json();

    form.querySelector("[name=city]").value = data.city || "";
    form.querySelector("[name=state]").value = data.state || "";
    form.querySelector("[name=country]").value = data.country || "";
    form.querySelector("[name=caption]").value = data.caption || "";

    openModal(); // smooth fade-in
  };
});