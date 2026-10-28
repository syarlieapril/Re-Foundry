(function () {
  "use strict";

  // ==========================================
  // KONFIGURASI
  // ==========================================

  const CATS = [
    "Dompet & Kartu",
    "Elektronik",
    "Kunci",
    "Tas",
    "Pakaian",
    "Buku & Alat Tulis",
    "Kartu Mahasiswa",
    "Lainnya"
  ];

  const db = window.supabaseClient;

  let items = [];
  let me = null;
  let uid = null;
  let tab = "all";
  let type = "lost";
  let photo = "";

  const $ = id => document.getElementById(id);

  // ==========================================
  // UTILITAS
  // ==========================================

  function esc(value) {
    const element = document.createElement("div");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
  }

  function fmtDate(value) {
    if (!value) return "";

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function todayLocal() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function openModal(id) {
    $(id)?.classList.add("on");
  }

  function closeModal(id) {
    $(id)?.classList.remove("on");
  }

  // ==========================================
  // NOTIFIKASI DAN KONFIRMASI
  // ==========================================

  function notify(message, type = "success") {
    showRFNotification(message, type);
  }

  function askConfirmation({
    title = "Konfirmasi",
    message = "Apakah kamu yakin?",
    confirmText = "Ya, lanjutkan",
    cancelText = "Batal",
    danger = false
  } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");

      overlay.style.cssText = `
        position:fixed;
        inset:0;
        z-index:100000;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(22,29,43,.52);
        backdrop-filter:blur(4px);
      `;

      const panel = document.createElement("div");
      panel.style.cssText = `
        width:100%;
        max-width:420px;
        box-sizing:border-box;
        padding:26px;
        border-radius:22px;
        background:#fffdf8;
        color:#20334e;
        box-shadow:0 20px 60px rgba(0,0,0,.2);
        font-family:inherit;
      `;

      const heading = document.createElement("h2");
      heading.textContent = title;
      heading.style.cssText = "margin:0 0 10px;font-size:21px;";

      const description = document.createElement("p");
      description.textContent = message;
      description.style.cssText =
        "margin:0 0 24px;color:#657187;line-height:1.7;" +
        "overflow-wrap:anywhere;";

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = cancelText;
      cancel.style.cssText = `
        flex:1;
        min-width:100px;
        padding:12px 16px;
        border:1px solid #e2dfd7;
        border-radius:12px;
        background:#fff;
        color:#20334e;
        cursor:pointer;
        font:inherit;
      `;

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.textContent = confirmText;
      confirm.style.cssText = `
        flex:1;
        min-width:100px;
        padding:12px 16px;
        border:0;
        border-radius:12px;
        background:${danger ? "#c43b3b" : "#20334e"};
        color:white;
        cursor:pointer;
        font:inherit;
      `;

      let finished = false;

      function finish(result) {
        if (finished) return;
        finished = true;
        document.removeEventListener("keydown", onEscape);
        overlay.remove();
        resolve(result);
      }

      function onEscape(event) {
        if (event.key === "Escape") finish(false);
      }

      cancel.addEventListener("click", () => finish(false));
      confirm.addEventListener("click", () => finish(true));

      overlay.addEventListener("click", event => {
        if (event.target === overlay) finish(false);
      });

      actions.append(cancel, confirm);
      panel.append(heading, description, actions);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      document.addEventListener("keydown", onEscape);
      confirm.focus();
    });
  }

  // ==========================================
  // KATEGORI
  // ==========================================

  function initCategories() {
    ["cat", "fCat"].forEach(id => {
      const select = $(id);
      if (!select) return;

      CATS.forEach(category => {
        const exists = Array.from(select.options).some(
          option => option.value === category
        );

        if (exists) return;

        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
      });
    });
  }

  // ==========================================
  // PEMROSESAN FOTO
  // ==========================================

  function shrink(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) {
        reject(new Error("Pilih file gambar yang valid."));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error("Gagal membaca file foto."));
      };

      reader.onload = () => {
        const image = new Image();

        image.onerror = () => {
          reject(new Error("Foto tidak valid atau rusak."));
        };

        image.onload = () => {
          const scale = Math.min(
            1,
            640 / Math.max(image.width, image.height)
          );

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext("2d");

          if (!context) {
            reject(new Error("Browser tidak mendukung pemrosesan foto."));
            return;
          }

          context.drawImage(
            image, 0, 0, canvas.width, canvas.height
          );

          try {
            let quality = 0.72;
            let data = canvas.toDataURL("image/jpeg", quality);

            while (data.length > 150000 && quality > 0.35) {
              quality = Math.max(0.35, quality - 0.1);
              data = canvas.toDataURL("image/jpeg", quality);
            }

            resolve(data);
          } catch {
            reject(new Error("Gagal memproses foto."));
          }
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function setupPhoto() {
    const input = $("fPhoto");
    const preview = $("prev");

    if (!input || !preview) return;

    const uploadBox = input.closest(".upload-box");
    let previewWrap = $("photoPreviewWrap");

    if (!previewWrap) {
      previewWrap = document.createElement("div");
      previewWrap.id = "photoPreviewWrap";
      previewWrap.style.cssText =
        "width:100%;margin-top:12px;text-align:left;";

      preview.parentNode.insertBefore(previewWrap, preview);
      previewWrap.appendChild(preview);
    }

    preview.style.cssText =
      "display:block;width:100%;max-width:100%;" +
      "max-height:380px;object-fit:contain;" +
      "border-radius:12px;margin:0 0 8px;";

    let actions = $("photoPreviewActions");

    if (!actions) {
      actions = document.createElement("div");
      actions.id = "photoPreviewActions";
      actions.style.cssText = "display:flex;gap:8px;margin-top:4px;";

      const changeButton = document.createElement("button");
      changeButton.type = "button";
      changeButton.textContent = "↻ Ganti gambar";
      changeButton.addEventListener("click", () => input.click());

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "× Hapus foto";

      deleteButton.addEventListener("click", () => {
        photo = "";
        input.value = "";
        preview.hidden = true;
        preview.removeAttribute("src");
        actions.hidden = true;

        if (uploadBox) uploadBox.hidden = false;
        if ($("err")) $("err").textContent = "";
      });

      actions.append(changeButton, deleteButton);
      previewWrap.appendChild(actions);
    }

    actions.hidden = true;

    input.addEventListener("change", async () => {
      const file = input.files?.[0];

      photo = "";
      preview.hidden = true;
      preview.removeAttribute("src");
      actions.hidden = true;

      if (uploadBox) uploadBox.hidden = false;
      if ($("err")) $("err").textContent = "";
      if (!file) return;

      try {
        photo = await shrink(file);
        preview.src = photo;
        preview.hidden = false;
        actions.hidden = false;

        if (uploadBox) uploadBox.hidden = true;
      } catch (error) {
        input.value = "";
        if ($("err")) $("err").textContent = error.message;
        notify(error.message, "error");
      }
    });
  }

  // ==========================================
  // KONVERSI DATA SUPABASE
  // ==========================================

  function mapRow(row) {
    return {
      id: row.id,
      by: row.user_id,
      title: row.item_name,
      desc: row.description || "",
      category: row.category || "Lainnya",
      location: row.location || "",
      date: row.lost_date || "",
      photo: row.image_url || "",
      status: row.status || "open",
      type: row.report_type || "lost",
      contact: row.contact || "",
      claimBy: row.claim_by || null,
      claimName: row.claim_name || "",
      claimNote: row.claim_note || "",
      claimAt: row.claim_at ? new Date(row.claim_at).getTime() : null,
      claimCode: row.claim_code || "",
      claimTry: row.claim_try || 0,
      foundProof: row.found_proof || "",
      verified: !!row.verified,
      doneAt: row.done_at ? new Date(row.done_at).getTime() : null,
      byName: row.user_id === uid
        ? (me?.name || me?.user_metadata?.name || "Mahasiswa")
        : "Mahasiswa",
      ts: row.created_at ? new Date(row.created_at).getTime() : 0
    };
  }

  async function loadItems() {
    if (!db) {
      throw new Error("Supabase belum terhubung. Periksa supabase.js.");
    }

    const { data, error } = await db
      .from("lost_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    items = (data || []).map(mapRow);
  }

  // ==========================================
  // PROFIL
  // ==========================================

  function setupProfile() {
    if (!me) return;

    const name =
      me.name ||
      me.user_metadata?.name ||
      me.email?.split("@")[0] ||
      "Mahasiswa";

    if ($("profileName")) $("profileName").textContent = name;
    if ($("profileEmail")) $("profileEmail").textContent = me.email || "";
    if ($("welcomeName")) $("welcomeName").textContent = "Halo, " + name + "!";

    if ($("profileAvatar")) {
      $("profileAvatar").textContent = name.trim().charAt(0).toUpperCase();
    }

    if ($("profileSettings")) {
      $("profileSettings").addEventListener("click", () => {
        location.href = "pengaturan.html";
      });
    }
  }

  // Ambil role dari tabel profiles, bukan hanya dari object Auth.
  async function loadMyRole() {
    if (!db || !uid) return;

    const { data, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      console.error("Gagal membaca role profil:", error);
      me.role = "user";
      return;
    }

    me.role = data?.role === "admin" ? "admin" : "user";
  }

  function setMode() {
    if ($("mode")) {
      $("mode").textContent = "2026 - Created by: Dina dan Syarlie";
    }

    if ($("add")) $("add").disabled = !me;
  }

  // ==========================================
  // TAMPILAN LAPORAN
  // ==========================================

  function render() {
    const list = $("list");
    if (!list) return;

    const query = $("q")?.value.trim().toLowerCase() || "";
    const category = $("cat")?.value || "";

    let lostCount = 0;
    let foundCount = 0;
    let doneCount = 0;

    items.forEach(item => {
      if (item.status === "done") {
        doneCount++;
      } else if (item.type === "lost") {
        lostCount++;
      } else {
        foundCount++;
      }
    });

    if ($("sLost")) $("sLost").textContent = lostCount;
    if ($("sFound")) $("sFound").textContent = foundCount;
    if ($("sDone")) $("sDone").textContent = doneCount;

    if (!me) {
      list.innerHTML = "";
      return;
    }

    const filtered = items
      .filter(item => {
        if (tab === "done" && item.status !== "done") return false;

        if (
          ["lost", "found"].includes(tab) &&
          (item.type !== tab || item.status === "done")
        ) {
          return false;
        }

        if (category && item.category !== category) return false;

        if (query) {
          const searchable = [
            item.title,
            item.location,
            item.desc,
            item.category,
            item.byName
          ].join(" ").toLowerCase();

          if (!searchable.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if ((a.status === "done") !== (b.status === "done")) {
          return a.status === "done" ? 1 : -1;
        }

        return (b.ts || 0) - (a.ts || 0);
      });

    if (!filtered.length) {
      list.innerHTML =
        '<div class="empty" style="grid-column:1/-1">' +
        "Belum ada laporan yang cocok. Coba ubah pencarian " +
        "atau buat laporan baru.</div>";

      if ($("emptyState")) $("emptyState").hidden = false;
      return;
    }

    if ($("emptyState")) $("emptyState").hidden = true;

    list.innerHTML = filtered.map(item => {
      const mine = item.by === uid;
      const claimer = item.claimBy === uid;
      const isDone = item.status === "done";
      const isClaimed = item.status === "claimed";

      const badge = isDone
        ? '<span class="badge done">Selesai</span>'
        : isClaimed
          ? '<span class="badge claim">Dalam Proses</span>'
          : "";

      const button = (action, label) =>
        '<button type="button" class="ghost" data-a="' +
        action + '" data-id="' + esc(item.id) + '">' +
        label + "</button>";

      let actions = "";
      let note = "";

      // Admin bisa mengedit semua laporan, user hanya miliknya sendiri.
      if (me?.role === "admin" || mine) {
        actions += button("edit", "Edit");
      }

      if (isClaimed) {
        note =
          '<div class="meta">Diklaim oleh <span class="who">' +
          esc(item.claimName || "Mahasiswa") +
          "</span> · Menunggu verifikasi pelapor</div>";

        if ((mine || claimer) && item.claimNote) {
          note += '<div class="desc">“' + esc(item.claimNote) + "”</div>";
        }

        if (claimer) {
          note +=
            '<div class="codebox">Kode serah terima<b>' +
            esc(item.claimCode) +
            "</b><small>Berikan kode ini saat barang diserahkan." +
            "</small></div>";
        }

        if (mine) {
          actions += button("confirm", "Verifikasi & selesaikan");
          actions += button("reject", "Tolak klaim");
        } else if (claimer) {
          actions += button("unclaim", "Batalkan klaim");
        }
      } else if (isDone) {
        note = '<div class="meta">Laporan selesai</div>';

        if (item.foundProof) {
          note +=
            '<div class="desc"><b>Foto bukti:</b>' +
            '<img src="' + esc(item.foundProof) +
            '" alt="Foto bukti" style="display:block;width:100%;' +
            'max-width:320px;max-height:260px;object-fit:contain;' +
            'margin-top:10px;border-radius:12px"></div>';
        }

        if (me.role === "admin") {
          actions += button("del", "Hapus");
        }
      } else {
        if (!mine) {
          actions += button(
            "claim",
            item.type === "found" ? "Ini barang saya" : "Saya menemukannya"
          );
        } else {
          if (item.type === "lost") {
            actions += button("done", "Sudah Ditemukan");
          }

          actions += button("del", "Hapus");
        }
      }

      const image = item.photo
        ? '<img class="photo" alt="Foto barang" src="' + esc(item.photo) + '">'
        : "";

      return (
        '<article class="card' + (isDone ? " done" : "") + '">' +
        badge + image +
        "<h3>" + esc(item.title) + "</h3>" +
        '<div class="meta">' + esc(item.category) + " · " +
        esc(item.location) +
        (item.date ? " · " + esc(fmtDate(item.date)) : "") +
        "</div>" +
        '<div class="meta">Dilaporkan oleh <span class="who">' +
        esc(item.byName) + "</span></div>" +
        note +
        (item.desc ? '<div class="desc">' + esc(item.desc) + "</div>" : "") +
        '<div class="contact"><b>Hubungi</b> ' + esc(item.contact) + "</div>" +
        (actions ? '<div class="acts">' + actions + "</div>" : "") +
        "</article>"
      );
    }).join("");
  }
    // ==========================================
  // FORM LAPORAN
  // ==========================================

  function openAnnouncement() {
    if (!me) {
      location.href = "login.html";
      return;
    }

    if ($("err")) $("err").textContent = "";
    openModal("modal");
    $("fTitle")?.focus();
  }

  function closeAnnouncement() {
    closeModal("modal");
  }

  function setupAnnouncementForm() {
    $("add")?.addEventListener("click", event => {
      event.preventDefault();
      openAnnouncement();
    });

    ["cancel", "cancelForm"].forEach(id => {
      $(id)?.addEventListener("click", event => {
        event.preventDefault();
        closeAnnouncement();
      });
    });

    $("modal")?.addEventListener("click", event => {
      if (event.target === $("modal")) closeAnnouncement();
    });

    $("announcementForm")?.addEventListener("submit", event => {
      event.preventDefault();
      saveAnnouncement();
    });
  }

  async function saveAnnouncement() {
    if (!me || !uid) {
      location.href = "login.html";
      return;
    }

    const title = $("fTitle")?.value.trim() || "";
    const locationText = $("fLoc")?.value.trim() || "";
    const contact = $("fContact")?.value.trim() || "";
    const errorElement = $("err");
    const saveButton = $("save");

    if (!title || !locationText || !contact) {
      const message = "Nama barang, lokasi, dan kontak wajib diisi.";
      if (errorElement) errorElement.textContent = message;
      notify(message, "error");
      return;
    }

    if (!db) {
      const message = "Supabase belum terhubung.";
      if (errorElement) errorElement.textContent = message;
      notify(message, "error");
      return;
    }

    if (errorElement) errorElement.textContent = "";
    if (saveButton) saveButton.disabled = true;

    try {
      const record = {
        user_id: uid,
        item_name: title,
        description: $("fDesc")?.value.trim() || "",
        category: $("fCat")?.value || "Lainnya",
        location: locationText,
        lost_date: $("fDate")?.value || todayLocal(),
        image_url: photo || null,
        status: "open",
        contact,
        report_type: type
      };

      const { data, error: insertError } = await db
        .from("lost_items")
        .insert(record)
        .select()
        .single();

      if (insertError) throw insertError;

      items.unshift(mapRow(data));

      $("announcementForm")?.reset();
      photo = "";

      if ($("fDate")) $("fDate").value = todayLocal();
      if ($("fPhoto")) $("fPhoto").value = "";

      if ($("prev")) {
        $("prev").hidden = true;
        $("prev").removeAttribute("src");
      }

      const uploadBox = $("fPhoto")?.closest(".upload-box");
      if (uploadBox) uploadBox.hidden = false;
      if ($("photoPreviewActions")) {
        $("photoPreviewActions").hidden = true;
      }

      type = "lost";

      $("typeSeg")?.querySelectorAll("[data-v]").forEach(button => {
        button.classList.toggle("on", button.dataset.v === "lost");
      });

      closeAnnouncement();
      render();
      notify("Laporan berhasil disimpan.");
    } catch (error) {
      console.error("Gagal menyimpan laporan:", error);

      const message = "Gagal menyimpan laporan: " +
        (error.message || "Periksa koneksi dan kebijakan RLS.");

      if (errorElement) errorElement.textContent = message;
      notify(message, "error");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  // ==========================================
  // TAB DAN FILTER
  // ==========================================

  function setupTabs() {
    $("q")?.addEventListener("input", render);
    $("cat")?.addEventListener("change", render);

    $("tabs")?.addEventListener("click", event => {
      const button = event.target.closest("[data-t]");
      if (!button) return;

      tab = button.dataset.t;

      $("tabs").querySelectorAll("[data-t]").forEach(element => {
        element.classList.toggle("on", element === button);
      });

      render();
    });

    // Hapus tombol filter Menunggu dari tampilan
    const waitingTab = $("tabs")?.querySelector('[data-t="claimed"]');
    if (waitingTab) waitingTab.remove();

    if (tab === "claimed") tab = "all";

    $("typeSeg")?.addEventListener("click", event => {
      const button = event.target.closest("[data-v]");
      if (!button) return;

      type = button.dataset.v;

      $("typeSeg").querySelectorAll("[data-v]").forEach(element => {
        element.classList.toggle("on", element === button);
      });
    });
  }

  // ==========================================
  // KONFIRMASI HAPUS
  // ==========================================

  function confirmDelete(item) {
    return askConfirmation({
      title: "Hapus laporan?",
      message: 'Kamu yakin ingin menghapus laporan "' +
        (item.title || "ini") +
        '"? Tindakan ini tidak dapat dibatalkan.',
      confirmText: "Ya, hapus",
      cancelText: "Batal",
      danger: true
    });
  }

  // ==========================================
  // KONFIRMASI BARANG DITEMUKAN
  // ==========================================

  function confirmFound() {
    return new Promise(resolve => {
      const overlay = document.createElement("div");

      overlay.style.cssText =
        "position:fixed;inset:0;z-index:100001;" +
        "background:rgba(0,0,0,.55);display:flex;" +
        "align-items:center;justify-content:center;padding:20px;" +
        "box-sizing:border-box;";

      const panel = document.createElement("div");
      panel.style.cssText =
        "background:#fffdf8;color:#20334e;width:100%;" +
        "max-width:460px;padding:26px;border-radius:22px;" +
        "box-sizing:border-box;box-shadow:0 20px 60px " +
        "rgba(0,0,0,.2);font-family:inherit;";

      const heading = document.createElement("h2");
      heading.textContent = "Konfirmasi Barang";
      heading.style.cssText = "margin:0 0 10px;text-align:center;";

      const description = document.createElement("p");
      description.textContent = "Apakah barang ini sudah ditemukan?";
      description.style.cssText =
        "text-align:center;color:#657187;line-height:1.6;";

      const label = document.createElement("label");
      label.htmlFor = "proofFile";
      label.textContent = "Foto bukti (opsional)";

      const input = document.createElement("input");
      input.id = "proofFile";
      input.type = "file";
      input.accept = "image/*";
      input.style.cssText = "display:block;width:100%;margin:12px 0;";

      const preview = document.createElement("img");
      preview.hidden = true;
      preview.alt = "Pratinjau foto";
      preview.style.cssText =
        "max-width:100%;max-height:220px;display:block;" +
        "margin:10px auto;border-radius:10px;";

      const errorElement = document.createElement("p");
      errorElement.style.cssText = "color:#c62828;font-size:13px;";

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:12px;";

      function styleButton(button, primary = false) {
        button.type = "button";
        button.style.cssText =
          "flex:1;padding:13px;border-radius:12px;" +
          "border:0;cursor:pointer;font:inherit;" +
          (primary
            ? "background:#20334e;color:white;"
            : "background:#f0eee8;color:#20334e;");
      }

      const noButton = document.createElement("button");
      noButton.textContent = "Belum";
      styleButton(noButton);

      const yesButton = document.createElement("button");
      yesButton.textContent = "Sudah";
      styleButton(yesButton, true);

      actions.append(noButton, yesButton);
      panel.append(
        heading, description, label, input, preview, errorElement, actions
      );

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      let proof = "";
      let closed = false;
      let processing = false;

      function finish(result) {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onEscape);
        overlay.remove();
        resolve(result);
      }

      function onEscape(event) {
        if (event.key === "Escape") finish(null);
      }

      input.addEventListener("change", async () => {
        const file = input.files?.[0];

        proof = "";
        preview.hidden = true;
        preview.removeAttribute("src");
        errorElement.textContent = "";

        if (!file) return;

        processing = true;
        yesButton.disabled = true;

        try {
          proof = await shrink(file);
          if (closed) return;
          preview.src = proof;
          preview.hidden = false;
        } catch (error) {
          if (!closed) {
            errorElement.textContent = error.message;
            notify(error.message, "error");
          }
        } finally {
          processing = false;
          if (!closed) yesButton.disabled = false;
        }
      });

      noButton.addEventListener("click", () => {
        finish({ confirmed: false });
      });

      yesButton.addEventListener("click", () => {
        if (processing) {
          errorElement.textContent = "Tunggu sampai foto selesai diproses.";
          return;
        }

        if (input.files?.[0] && !proof) {
          errorElement.textContent =
            "Foto belum berhasil diproses. Coba pilih ulang.";
          return;
        }

        finish({ confirmed: true, proof });
      });

      overlay.addEventListener("click", event => {
        if (event.target === overlay) finish(null);
      });

      document.addEventListener("keydown", onEscape);
    });
  }
    // ==========================================
  // AKSI DAN UPDATE DATABASE
  // ==========================================

  async function updateItem(item, patch) {
    const { data, error } = await db
      .from("lost_items")
      .update(patch)
      .eq("id", item.id)
      .select()
      .single();

    if (error) throw error;

    const updated = mapRow(data);

    items = items.map(entry =>
      String(entry.id) === String(item.id) ? updated : entry
    );
  }

  function setupListActions() {
    const list = $("list");
    if (!list) return;

    list.addEventListener("click", async event => {
      const button = event.target.closest("button[data-a]");
      if (!button || button.disabled) return;

      const item = items.find(
        entry => String(entry.id) === String(button.dataset.id)
      );

      if (!item) return;

      const action = button.dataset.a;
      const own = item.by === uid;
      const isAdmin = me?.role === "admin";

      if (["claim", "confirm", "reject", "unclaim"].includes(action)) {
        notify(
          "Fitur klaim sedang dinonaktifkan sampai fungsi database " +
          "yang aman dibuat. Ini untuk melindungi data pengguna.",
          "error"
        );
        return;
      }

      if (action === "del") {
        if (item.status === "done" && !isAdmin) {
          notify("Hanya admin yang boleh menghapus laporan selesai.", "error");
          return;
        }

        if (item.status !== "done" && !own && !isAdmin) {
          notify("Kamu hanya boleh menghapus laporan milikmu sendiri.", "error");
          return;
        }
      }

      if (action === "done" && !own) {
        notify("Hanya pemilik laporan yang boleh mengubah statusnya.", "error");
        return;
      }

      button.disabled = true;

      try {
        if (action === "edit") {
          if (!isAdmin && !own) {
            notify(
              "Kamu hanya boleh mengedit laporan milikmu sendiri.",
              "error"
            );
            return;
          }

          const title = window.prompt("Nama barang:", item.title);
          if (title === null) return;

          const locationText = window.prompt("Lokasi:", item.location);
          if (locationText === null) return;

          const description = window.prompt("Deskripsi:", item.desc);
          if (description === null) return;

          const category = window.prompt(
            "Kategori (" + CATS.join(", ") + "):",
            item.category
          );
          if (category === null) return;

          const date = window.prompt("Tanggal (YYYY-MM-DD):", item.date);
          if (date === null) return;

          const contact = window.prompt("Kontak:", item.contact);
          if (contact === null) return;

          const status = window.prompt(
            "Status (open, claimed, done):",
            item.status
          );
          if (status === null) return;

          if (!title.trim() || !locationText.trim() || !contact.trim()) {
            notify(
              "Nama barang, lokasi, dan kontak wajib diisi.",
              "error"
            );
            return;
          }

          if (!["open", "claimed", "done"].includes(status.trim())) {
            notify(
              "Status harus open, claimed, atau done.",
              "error"
            );
            return;
          }

          await updateItem(item, {
            item_name: title.trim(),
            location: locationText.trim(),
            description: description.trim(),
            category: CATS.includes(category.trim())
              ? category.trim()
              : item.category,
            lost_date: date.trim() || null,
            contact: contact.trim(),
            status: status.trim(),
            done_at: status.trim() === "done"
              ? (
                  item.doneAt
                    ? new Date(item.doneAt).toISOString()
                    : new Date().toISOString()
                )
              : null
          });

          notify("Laporan berhasil diperbarui.");
        } else if (action === "done") {
          if (item.type !== "lost" || item.status !== "open") return;

          const confirmation = await confirmFound();
          if (!confirmation?.confirmed) return;

          await updateItem(item, {
            status: "done",
            done_at: new Date().toISOString(),
            found_proof: confirmation.proof || null
          });

          notify("Status laporan berhasil diperbarui.");
        } else if (action === "del") {
          if (item.status === "claimed") {
            notify("Batalkan klaim terlebih dahulu.", "error");
            return;
          }

          if (!await confirmDelete(item)) return;

          const { error } = await db
            .from("lost_items")
            .delete()
            .eq("id", item.id);

          if (error) throw error;

          items = items.filter(
            entry => String(entry.id) !== String(item.id)
          );

          notify("Laporan berhasil dihapus.");
        } else {
          return;
        }

        render();
      } catch (error) {
        console.error("Gagal mengubah laporan:", error);
        notify(
          "Perubahan gagal disimpan: " +
          (error.message || "Periksa kebijakan RLS."),
          "error"
        );
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    });
  }

  // ==========================================
  // MULAI APLIKASI
  // ==========================================

  async function start() {
    if (!window.Auth || typeof window.Auth.current !== "function") {
      notify("Auth tidak ditemukan. Periksa file auth.js.", "error");
      return;
    }

    try {
      if (typeof window.Auth.ready === "function") {
        await window.Auth.ready();
      }

      me = await window.Auth.current();

      if (!me) {
        location.replace("login.html");
        return;
      }

      uid = me.id;

      await loadMyRole();

      initCategories();
      if ($("fDate")) $("fDate").value = todayLocal();

      setupProfile();
      setMode();
      setupPhoto();
      setupAnnouncementForm();
      setupTabs();
      setupListActions();

      await loadItems();
      render();
    } catch (error) {
      console.error("Gagal memuat Re:foundry:", error);

      if ($("mode")) {
        $("mode").textContent = "Gagal terhubung ke Supabase.";
      }

      notify(
        "Gagal memuat laporan: " +
        (error.message || "Periksa koneksi, login, dan RLS."),
        "error"
      );
    }
  }

  start();
})();

// ==========================================
// NOTIFIKASI CUSTOM RE:FOUNDRY
// ==========================================

function showRFNotification(message, type = "success") {
  const oldToast = document.querySelector(".rf-toast");
  if (oldToast) oldToast.remove();

  const toast = document.createElement("div");
  toast.className =
    "rf-toast" + (type === "error" ? " rf-toast-error" : "");

  const icon = document.createElement("div");
  icon.className = "rf-toast-icon";
  icon.textContent = type === "error" ? "!" : "✓";

  const content = document.createElement("div");
  content.className = "rf-toast-content";

  const title = document.createElement("p");
  title.className = "rf-toast-title";
  title.textContent =
    type === "error" ? "Oops, ada kendala" : "Berhasil!";

  const text = document.createElement("p");
  text.className = "rf-toast-message";
  text.textContent = message;

  const close = document.createElement("button");
  close.className = "rf-toast-close";
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Tutup notifikasi");
  close.addEventListener("click", () => toast.remove());

  content.append(title, text);
  toast.append(icon, content, close);
  document.body.appendChild(toast);

  window.setTimeout(() => toast.remove(), 4000);
}