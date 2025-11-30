// home/static/home/js/pin_modals.js
// ------------------------------------------------------
// Handles all UI logic for:
//  - Opening/closing the "Add / Edit Pin" modal
//  - Submitting the form to create or update a pin
//  - Exposing window.openEditModal(pinId) so main.js
//    can open the modal when a marker is clicked
// ------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM ELEMENT REFERENCES ----------

  // Main modal wrapper (dark overlay behind the card).
  // NOTE: Visibility is controlled purely by the `hidden` class:
  //   - has `hidden`  → hidden
  //   - lacks `hidden` → visible
  // The CSS in add_pin.html implements this behavior.
  const modal = document.getElementById("pinModal");

  // Floating "+ Add Pin" button (top-right of the globe)
  const addBtn = document.getElementById("addPinBtn");

  // "Cancel" button inside the modal
  const closeBtn = document.getElementById("closeModal");

  // Form element inside the modal that holds pin data
  const form = document.getElementById("pinForm");

  // Title + subtitle text at the top of the modal
  const titleEl = document.getElementById("pinModalTitle");
  const subtitleEl = document.getElementById("pinModalSubtitle");

  // Container where existing photos will be rendered as thumbnails
  const existingPhotosContainer = document.getElementById("existingPhotos");

  // Hidden input that will hold a comma-separated list of photo IDs to delete
  const photosToDeleteInput = document.getElementById("photosToDelete");

  // File input for adding new photos (supports multiple)
  const photoFilesInput = form.querySelector('input[name="photos"]');

  // Keep track of which existing photo IDs the user marked for removal
  let photosMarkedForDelete = new Set();

  // ---------- STATE ----------

  // Tracks what the modal is doing:
  //  - "add"  → creating a new pin
  //  - "edit" → editing an existing pin
  let mode = "add";

  // When editing, we store the pin's id here so we know
  // which /api/edit-pin/<id>/ endpoint to call.
  let currentPinId = null;

  // ---------- OPEN MODAL IN "ADD" MODE ----------

  // When the "+ Add Pin" button is clicked:
  //  - switch mode to "add"
  //  - clear any previous form values
  //  - show the modal
  if (addBtn) {
    addBtn.onclick = () => {
      // Switch modal into "add" mode (we're creating a brand‑new pin)
      mode = "add";
      currentPinId = null;

      // Clear any previous values the form might have had
      form.reset();

      // Reset multi-photo state when adding a new pin
      photosMarkedForDelete.clear();
      if (photosToDeleteInput) photosToDeleteInput.value = "";
      if (existingPhotosContainer) existingPhotosContainer.innerHTML = "";
      // Title + subtitle text at the top of the modal
      const titleEl = document.getElementById("pinModalTitle");
      const subtitleEl = document.getElementById("pinModalSubtitle");

      // Show the modal by REMOVING the `hidden` class.
      // CSS in add_pin.html uses:
      //   #pinModal.modal { display: flex; ... }
      //   #pinModal.hidden { display: none; }
      //
      // So:
      //   - when `hidden` is present  → modal is invisible
      //   - when `hidden` is removed → modal becomes visible
      modal.classList.remove("hidden");
    };
  }

  // ---------- CLOSE MODAL (CANCEL) ----------

  // Clicking "Cancel" just hides the modal and keeps
  // whatever is on the globe as-is.
  if (closeBtn) {
    // Clicking "Cancel" should just hide the modal again.
    // We do this by ADDING the `hidden` class back.
    closeBtn.onclick = () => modal.classList.add("hidden");
  }

  // ---------- SUBMIT HANDLER (ADD OR EDIT) ----------

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Send all form fields (including file uploads) as FormData
    const formData = new FormData(form);

    // By default, assume "add" mode.
    // These URLs are provided by map.html as globals:
    //  - window.ADD_PIN_URL          → "{% url 'add_pin' %}"
    //  - window.EDIT_PIN_BASE_URL   → "/api/edit-pin/"
    let url = window.ADD_PIN_URL;

    // If we're editing an existing pin, switch to the edit endpoint
    if (mode === "edit" && currentPinId) {
      url = `${window.EDIT_PIN_BASE_URL}${currentPinId}/`;
    }

    // Send POST request to backend (Django view)
    const res = await fetch(url, {
      method: "POST",
      headers: {
        // CSRF token pulled from the hidden input Django renders
        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")
          .value,
      },
      body: formData,
    });

    if (res.ok) {
      // Response contains the saved/updated pin data
      const data = await res.json();

      // Hide modal + reset form fields
      //
      // We add the `hidden` class back so that CSS switches the
      // modal's display back to "none".
      modal.classList.add("hidden");
      form.reset();

      // If main.js exposes addPinToGlobe(pinData), use it to:
      //  - add the new marker to the globe, or
      //  - update an existing marker in-place
      //
      // Otherwise, just reload the page as a fallback.
      if (window.addPinToGlobe) {
        window.addPinToGlobe(data);
      } else {
        window.location.reload();
      }
    } else {
      // Very basic error handling for now
      alert("Failed to save pin");
    }
  });

  // ---------- GLOBAL FUNCTION: openEditModal(pinId) ----------

  // This function is called from main.js when the user clicks
  // on a marker they own.
  //
  // Flow:
  //  1. Fetch pin data from backend
  //  2. Swap modal into "edit" mode
  //  3. Prefill the form with existing values
  //  4. Show the modal
  window.openEditModal = async function (pinId) {
    // 🔹 Close pin details modal if it's open, so we don't overlap
    const detailsModal = document.getElementById("pinDetailsModal");
    if (detailsModal) {
      // fully hide the details modal so it doesn't block clicks
      detailsModal.classList.remove("show");
      detailsModal.classList.add("hidden");
    }

    // GET existing pin data from Django
    const res = await fetch(`/api/pin/${pinId}/`, {
      credentials: "same-origin",
    });

    if (!res.ok) {
      alert("Could not load pin data.");
      return;
    }

    const pinData = await res.json();

    // ---------- MULTI-PHOTO UI (EXISTING PHOTOS) ----------

    // Clear previous edit state
    photosMarkedForDelete.clear();
    if (photosToDeleteInput) photosToDeleteInput.value = "";

    // Reset any existing thumbnails in the container
    if (existingPhotosContainer) {
      existingPhotosContainer.innerHTML = "";

      // pinData.photos should be an array like:
      //   [ { id: 21, url: "..." }, { id: 22, url: "..." }, ... ]
      const photos = pinData.photos || [];

      photos.forEach((photo) => {
        // Create a wrapper for each thumbnail + delete button
        const wrapper = document.createElement("div");
        wrapper.className = "existing-photo-thumb";
        wrapper.style.position = "relative";
        wrapper.style.display = "inline-block";
        wrapper.style.marginRight = "8px";
        wrapper.style.marginBottom = "8px";

        // The thumbnail image
        const img = document.createElement("img");
        img.src = photo.url;
        img.alt = "Existing pin photo";
        img.style.width = "72px";
        img.style.height = "72px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.style.boxShadow = "0 4px 10px rgba(15,23,42,0.35)";

        // Small "X" delete badge in the top-right corner
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "×";
        delBtn.title = "Remove this photo";
        delBtn.style.position = "absolute";
        delBtn.style.top = "2px";
        delBtn.style.right = "2px";
        delBtn.style.width = "18px";
        delBtn.style.height = "18px";
        delBtn.style.borderRadius = "999px";
        delBtn.style.border = "none";
        delBtn.style.background = "rgba(15,23,42,0.85)";
        delBtn.style.color = "#e5e7eb";
        delBtn.style.cursor = "pointer";
        delBtn.style.fontSize = "12px";
        delBtn.style.display = "flex";
        delBtn.style.alignItems = "center";
        delBtn.style.justifyContent = "center";

        // When clicked, mark this photo as "to delete" and remove from UI
        delBtn.addEventListener("click", () => {
          photosMarkedForDelete.add(photo.id);
          wrapper.remove();

          // Update hidden input value, e.g. "21,22"
          if (photosToDeleteInput) {
            photosToDeleteInput.value = Array.from(photosMarkedForDelete).join(
              ","
            );
          }
        });

        wrapper.appendChild(img);
        wrapper.appendChild(delBtn);
        existingPhotosContainer.appendChild(wrapper);
      });
    }

    // Optionally clear the file input so user can add new photos on each edit
    if (photoFilesInput) {
      photoFilesInput.value = "";
    }

    // Switch modal to "edit" mode + remember which pin we're editing
    mode = "edit";
    currentPinId = pinId;
    // Switch modal to "edit" mode + remember which pin we're editing
    mode = "edit";
    currentPinId = pinId;

    // 🔹 Set header text for EDIT mode
    if (titleEl) {
      titleEl.textContent = "Edit your pin ✏️";
    }
    if (subtitleEl) {
      subtitleEl.textContent =
        "Update your photos, caption, or location for this memory.";
    }

    // Prefill human-readable location fields instead of raw lat/lon
    const cityInput = form.querySelector('[name="city"]');
    const stateInput = form.querySelector('[name="state"]');
    const countryInput = form.querySelector('[name="country"]');
    const captionInput = form.querySelector('[name="caption"]');

    if (cityInput) cityInput.value = pinData.city || "";
    if (stateInput) stateInput.value = pinData.state || "";
    if (countryInput) countryInput.value = pinData.country || "";
    if (captionInput) captionInput.value = pinData.caption || "";

    // Show the modal for editing by removing `hidden`.
    // This uses the same visibility mechanism as the "Add Pin" flow.
    modal.classList.remove("hidden");
  };
});

//allows for profile dropdown menu
document.addEventListener("DOMContentLoaded", function () {
  const trigger = document.getElementById("profile-trigger");
  const dropdown = document.getElementById("profile-dropdown");

  if (!trigger || !dropdown) return;

  trigger.addEventListener("click", function (event) {
    event.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", function () {
    dropdown.classList.remove("open");
  });
});