document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("galleryGrid");
  const countryFilter = document.getElementById("countryFilter");
  const captionSearchInput = document.getElementById("captionSearch");
  const dateFromInput = document.getElementById("dateFrom");
  const dateToInput = document.getElementById("dateTo");
  const sortSelect = document.getElementById("sortOrder");
  // --- Lightbox DOM elements (for big photo overlay) ---
  const lightbox = document.getElementById("photoLightbox");
  const lbImg = document.getElementById("lightboxImg");
  const lbCaption = document.getElementById("lightboxCaption");
  const lbLocation = document.getElementById("lightboxLocation");
  const lbDate = document.getElementById("lightboxDate");
  const lbCloseBtn = document.getElementById("lightboxCloseBtn");

  let allPhotos = [];

  function applyFiltersAndRender() {
    if (!grid) return;

    // Start from the full set
    let filtered = [...allPhotos];

    // Country filter
    if (countryFilter && countryFilter.value) {
      const cVal = countryFilter.value;
      filtered = filtered.filter((p) => p.country === cVal);
    }

    // Text search: caption / city / country
    const q =
      captionSearchInput && captionSearchInput.value
        ? captionSearchInput.value.trim().toLowerCase()
        : "";
    if (q) {
      filtered = filtered.filter((p) => {
        const caption = (p.caption || "").toLowerCase();
        const city = (p.city || "").toLowerCase();
        const country = (p.country || "").toLowerCase();
        return (
          caption.includes(q) ||
          city.includes(q) ||
          country.includes(q)
        );
      });
    }

    // Date range filter (if createdAt is provided)
    const fromVal = dateFromInput ? dateFromInput.value : "";
    const toVal = dateToInput ? dateToInput.value : "";

    if (fromVal) {
      const fromDate = new Date(fromVal + "T00:00:00");
      filtered = filtered.filter(
        (p) => p._createdAtDate && p._createdAtDate >= fromDate
      );
    }

    if (toVal) {
      const toDate = new Date(toVal + "T23:59:59");
      filtered = filtered.filter(
        (p) => p._createdAtDate && p._createdAtDate <= toDate
      );
    }

    // Sorting
    const mode = sortSelect ? sortSelect.value : "newest";
    filtered.sort((a, b) => {
      const da = a._createdAtDate;
      const db = b._createdAtDate;

      switch (mode) {
        case "oldest":
          if (da && db) return da - db;
          if (da) return 1;
          if (db) return -1;
          return 0;
        case "caption-asc":
          return (a.caption || "").localeCompare(b.caption || "");
        case "caption-desc":
          return (b.caption || "").localeCompare(a.caption || "");
        case "newest":
        default:
          if (da && db) return db - da;
          if (db) return 1;
          if (da) return -1;
          return 0;
      }
    });

    // Finally render the filtered, sorted list
    renderPhotos(filtered);
  }

  // Open the lightbox with the given photo object
  function openLightbox(photo) {
    if (!lightbox) return;

    // Large image
    if (lbImg) {
      lbImg.src = photo.imageUrl;
      lbImg.alt = photo.caption || "Pin photo";
    }

    // Caption
    if (lbCaption) {
      lbCaption.textContent = photo.caption || "No caption";
    }

    // Location
    if (lbLocation) {
      const loc =
        photo.city && photo.country
          ? `${photo.city}, ${photo.country}`
          : photo.country || "Unknown location";
      lbLocation.textContent = loc;
    }

    // Date
    if (lbDate) {
      if (photo.createdAt) {
        const d = new Date(photo.createdAt);
        lbDate.textContent = d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } else {
        lbDate.textContent = "";
      }
    }

    // Show overlay
    lightbox.classList.add("show");
  }

  // Close and reset the lightbox
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("show");
  }

  // Hook up close button, background click, and Escape key
  if (lbCloseBtn) {
    lbCloseBtn.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    // Clicking on the dark background (not the panel) closes it
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
    }
  });

  async function fetchPhotos() {
    try {
      const res = await fetch("/api/my-photos/", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Normalize photos and precompute Date objects for createdAt
      allPhotos = (data.photos || []).map((p) => ({
        ...p,
        _createdAtDate: p.createdAt ? new Date(p.createdAt) : null,
      }));

      buildCountryFilter(allPhotos);
      applyFiltersAndRender();
    } catch (err) {
      console.error("Failed to load gallery photos:", err);
      grid.innerHTML = "<p style='color:#e5e7eb;'>Could not load photos.</p>";
    }
  }

  function buildCountryFilter(photos) {
    if (!countryFilter) return;
    const countries = new Set();

    photos.forEach((p) => {
      if (p.country) countries.add(p.country);
    });

    // Clear existing options except "All"
    countryFilter.innerHTML = '<option value="">All countries</option>';

    Array.from(countries)
      .sort()
      .forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        countryFilter.appendChild(opt);
      });
  }

  function renderPhotos(photos) {
    grid.innerHTML = "";

    if (!photos.length) {
      grid.innerHTML =
        "<p style='color:#e5e7eb;'>You haven't added any photos yet.</p>";
      return;
    }

    photos.forEach((p) => {
      const card = document.createElement("article");
      card.className = "gallery-card";
      card.style.cssText = `
        background: rgba(15,23,42,0.96);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(15,23,42,0.8);
        border: 1px solid rgba(148,163,184,0.35);
        transition: transform 0.18s ease, box-shadow 0.18s ease;
        cursor: pointer;
      `;

      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-4px) scale(1.01)";
        card.style.boxShadow = "0 24px 55px rgba(15,23,42,0.95)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0) scale(1.0)";
        card.style.boxShadow = "0 18px 40px rgba(15,23,42,0.8)";
      });
      // Clicking a tile opens the big overlay view
      card.addEventListener("click", () => {
        openLightbox(p);
      });

      const img = document.createElement("img");
      img.src = p.imageUrl;
      img.alt = p.caption || "Pin photo";
      img.style.width = "100%";
      img.style.objectFit = "cover";

      const body = document.createElement("div");
      body.style.cssText = `
        padding: 10px 12px 12px;
        font-family: system-ui, -apple-system, Segoe UI, Inter, sans-serif;
      `;

      const captionEl = document.createElement("div");
      captionEl.style.cssText =
        "font-size: 14px; font-weight: 500; color: #e5e7eb; margin-bottom: 4px;";
      captionEl.textContent = p.caption || "No caption";

      const metaRow = document.createElement("div");
      metaRow.style.cssText =
        "display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#9ca3af;";

      const locSpan = document.createElement("span");
      locSpan.textContent =
        p.city && p.country
          ? `${p.city}, ${p.country}`
          : p.country || "Unknown location";

      const dateSpan = document.createElement("span");
      if (p.createdAt) {
        const d = new Date(p.createdAt);
        dateSpan.textContent = d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } else {
        dateSpan.textContent = "";
      }

      metaRow.appendChild(locSpan);
      metaRow.appendChild(dateSpan);

      body.appendChild(captionEl);
      body.appendChild(metaRow);

      card.appendChild(img);
      card.appendChild(body);

      // later: clicking card could open the pin details modal / route to pin view
      grid.appendChild(card);
    });
  }

  // Wire up filters / sorting to re-run the pipeline
  if (countryFilter) {
    countryFilter.addEventListener("change", applyFiltersAndRender);
  }
  if (captionSearchInput) {
    captionSearchInput.addEventListener("input", applyFiltersAndRender);
  }
  if (dateFromInput) {
    dateFromInput.addEventListener("change", applyFiltersAndRender);
  }
  if (dateToInput) {
    dateToInput.addEventListener("change", applyFiltersAndRender);
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", applyFiltersAndRender);
  }

  // Initial load
  fetchPhotos();
});
