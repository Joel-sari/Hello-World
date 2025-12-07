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

    /* 🚀 Immediately close modal on Save click */
    closeModal();

    const formData = new FormData(form);

    let url = window.ADD_PIN_URL; // "/api/add-pin/"
    if (mode === "edit" && currentPinId) {
      url = `${window.EDIT_PIN_BASE_URL}${currentPinId}/`;
    }

    /* Fire-and-forget save request */
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

// ===============================
// EDIT PROFILE MODAL HANDLING
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const editModal = document.getElementById("editProfileModal");
  const editForm = document.getElementById("editProfileForm");
  const cancelBtn = document.getElementById("cancelEditProfile");
  // Open trigger from the profile dropdown
  const openEditBtn = document.getElementById("edit-profile-btn"); // if you have a button/link to open it

  // Smoothly open the Edit Profile modal
  function openEditModal() {
    if (!editModal) return;
    editModal.classList.remove("hidden");
    void editModal.offsetWidth; // force reflow so transition applies
    editModal.classList.add("modal-visible");
  }

  // Smoothly close the Edit Profile modal
  function closeEditModal() {
    if (!editModal) return;
    editModal.classList.remove("modal-visible");
    setTimeout(() => editModal.classList.add("hidden"), 250); // match CSS transition
  }

  // Open trigger (if you have one)
  if (openEditBtn) {
    openEditBtn.addEventListener("click", openEditModal);
  }

  // Cancel button closes modal
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeEditModal);
  }

  // Save (submit) closes modal immediately, then sends request
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // 🚀 Close as soon as Save is clicked
      closeEditModal();

      const formData = new FormData(editForm);

      const res = await fetch("/api/edit-profile/", {
        method: "POST",
        headers: {
          "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")
            .value,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData,
      });

      if (!res.ok) {
        console.error("Edit profile error:", res);
        alert("Failed to update profile.");
        return;
      }

      // On success, just reload the page so avatar/username/bio update
      window.location.reload();
    });
  }
});






// ------------------------------------------------------------
//  PIN MODALS + EDIT PROFILE MODAL (ALL INSIDE DOMContentLoaded)
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    console.log("DEBUG: DOM Loaded");

    // =============================================================
    //  PIN MODAL LOGIC  (unchanged)
    // =============================================================
    const modal = document.getElementById("pinModal");
    const addBtn = document.getElementById("addPinBtn");
    const closeBtn = document.getElementById("closeModal");
    const form = document.getElementById("pinForm");

    if (addBtn && modal) {
        addBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
    }


    // =============================================================
    //  ⭐ EDIT PROFILE MODAL LOGIC
    // =============================================================

    const editProfileLink = document.getElementById("edit-profile-link");
    const editProfileModal = document.getElementById("editProfileModal");
    const closeProfileModal = document.getElementById("cancelEditProfile");
    const editProfileForm = document.getElementById("editProfileForm");

    const preview = document.getElementById("profile-avatar-preview");
    const styleSelect = document.getElementById("avatar-style-select");
    const seedInput = document.getElementById("avatar-seed-input");
    const shuffleBtn = document.getElementById("shuffle-avatar-btn");

    const uploadInput = document.getElementById("avatar-upload-input");
    const generatedControls = document.getElementById("generated-avatar-controls");
    const uploadControls = document.getElementById("upload-avatar-controls");
    const modeRadios = document.querySelectorAll("input[name='avatar_mode']");
    const topRightAvatar = document.getElementById("profile-avatar-img");

    function getCSRF() {
        const el = document.querySelector("[name=csrfmiddlewaretoken]");
        return el ? el.value : "";
    }

    function buildUrl(style, seed) {
        return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    }


    // ------------------------------
    //  OPEN EDIT PROFILE MODAL
    // ------------------------------
    if (editProfileLink && editProfileModal) {
        editProfileLink.addEventListener("click", async () => {
            console.log("DEBUG: Edit Profile clicked");

            const res = await fetch("/api/profile/");
            const data = await res.json();

            // Fill text inputs
            document.getElementById("full-name-input").value = data.full_name || "";
            document.getElementById("favorite-country-input").value = data.favorite_country || "";
            document.getElementById("bio-input").value = data.bio || "";

            // Fill avatar choices
            styleSelect.value = data.avatar_style || "pixel-art";
            seedInput.value = data.avatar_seed || "";

            preview.src = buildUrl(styleSelect.value, seedInput.value);

            // Show modal
            editProfileModal.classList.remove("hidden");
        });
    }


    // ------------------------------
    //  CLOSE EDIT PROFILE MODAL
    // ------------------------------
    if (editProfileLink && editProfileModal) {
        editProfileLink.addEventListener("click", async (e) => {
            e.stopPropagation();  // ⭐ FIX: prevents dropdown from instantly closing

            console.log("DEBUG: Edit Profile clicked");

            const res = await fetch("/api/profile/");
            const data = await res.json();

            // Fill fields...
            editProfileModal.classList.remove("hidden");
        });
    }


    // ------------------------------
    //  TOGGLE AVATAR MODES
    // ------------------------------
    modeRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "generated") {
                generatedControls.style.display = "block";
                uploadControls.style.display = "none";
                preview.src = buildUrl(styleSelect.value, seedInput.value);
            } else {
                generatedControls.style.display = "none";
                uploadControls.style.display = "block";
            }
        });
    });


    // ------------------------------
    //  SHUFFLE AVATAR
    // ------------------------------
    if (shuffleBtn) {
        shuffleBtn.addEventListener("click", () => {
            const newSeed = "seed-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9);
            seedInput.value = newSeed;
            preview.src = buildUrl(styleSelect.value, newSeed);
        });
    }


    // ------------------------------
    //  UPLOAD PREVIEW
    // ------------------------------
    if (uploadInput) {
        uploadInput.addEventListener("change", () => {
            const file = uploadInput.files[0];
            if (file) preview.src = URL.createObjectURL(file);
        });
    }


    // ------------------------------
    //  SAVE EDIT PROFILE
    // ------------------------------
    if (editProfileForm) {
        editProfileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const formData = new FormData(editProfileForm);

            const res = await fetch("/api/profile/", {
                method: "POST",
                headers: { "X-CSRFToken": getCSRF() },
                body: formData,
            });

            const data = await res.json();

            // Update avatar in navbar
            if (data.avatar_upload_url) {
                topRightAvatar.src = data.avatar_upload_url;
            } else {
                topRightAvatar.src = buildUrl(data.avatar_style, data.avatar_seed);
            }

            editProfileModal.classList.add("hidden");
        });
    }

});
