// home/static/home/js/pin_modals.js
// ------------------------------------------------------
// Handles Add/Edit Pin modal + AJAX POST submission
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("pinModal");
  const addBtn = document.getElementById("addPinBtn");
  const closeBtn = document.getElementById("closeModal");
  const form = document.getElementById("pinForm");

  let mode = "add";
  let currentPinId = null;

  // OPEN ADD PIN MODAL
  if (addBtn) {
    addBtn.onclick = () => {
      mode = "add";
      currentPinId = null;
      form.reset();
      modal.classList.remove("hidden");
    };
  }

  // CLOSE MODAL
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.add("hidden");
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
        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]").value,

        // 🔥 REQUIRED FOR DJANGO TO RECOGNIZE AJAX POST
        "X-Requested-With": "XMLHttpRequest",
      },
      body: formData,
    });

    if (!res.ok) {
      console.error("Save pin error:", res);
      alert("Failed to save pin");
      return;
    }

    const data = await res.json();

    modal.classList.add("hidden");
    form.reset();

    if (window.addPinToGlobe) {
      window.addPinToGlobe(data);
    } else {
      window.location.reload();
    }
  });

  // OPEN EDIT PIN MODAL
  window.openEditModal = async function (pinId) {
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

    modal.classList.remove("hidden");
  };
});
